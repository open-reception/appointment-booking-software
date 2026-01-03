import { getTenantDb } from "../db";
import { notification, channelStaff } from "../db/tenant-schema";
import { eq, and } from "drizzle-orm";
import logger from "$lib/logger";
import { z } from "zod";
import { ValidationError, NotFoundError } from "../utils/errors";
import { supportedLocales } from "$lib/const/locales";

const notificationCreationSchema = z.object({
  channelId: z.uuid({ message: "Invalid UUID format" }),
  title: z
    .partialRecord(z.enum(supportedLocales), z.string().min(1).max(200))
    .refine((value) => value != null && Object.keys(value).length > 0, {
      message: "At least one localized title is required",
    }),
  description: z
    .partialRecord(z.enum(supportedLocales), z.string().min(1))
    .refine((value) => value != null && Object.keys(value).length > 0, {
      message: "At least one localized description is required",
    }),
});

export type NotificationCreationRequest = z.infer<typeof notificationCreationSchema>;

export interface SelectNotification {
  id: string;
  staffId: string;
  title: { [key: string]: string };
  description: { [key: string]: string };
  isRead: boolean;
}

export class NotificationService {
  #db: Awaited<ReturnType<typeof getTenantDb>> | null = null;

  private constructor(public readonly tenantId: string) {}

  /**
   * Create a notification service for a specific tenant
   * @param tenantId The ID of the tenant
   * @returns new NotificationService instance
   */
  static async forTenant(tenantId: string) {
    const log = logger.setContext("NotificationService");
    log.debug("Creating notification service for tenant", { tenantId });

    try {
      const service = new NotificationService(tenantId);
      service.#db = await getTenantDb(tenantId);

      log.debug("Notification service created successfully", { tenantId });
      return service;
    } catch (error) {
      log.error("Failed to create notification service", { tenantId, error: String(error) });
      throw error;
    }
  }

  /**
   * Create a new notification for all staff members in a channel
   * @param request Notification creation request data
   * @returns Array of created notification IDs
   */
  async createNotification(request: NotificationCreationRequest): Promise<string[]> {
    const log = logger.setContext("NotificationService.createNotification");
    log.debug("Creating notification for channel", { channelId: request.channelId });

    if (!this.#db) {
      log.error("Database connection not initialized");
      throw new Error("Database connection not initialized");
    }

    // Validate request
    try {
      notificationCreationSchema.parse(request);
    } catch (error) {
      log.warn("Invalid notification creation request", { error });
      throw new ValidationError("Invalid notification data");
    }

    try {
      // Get all staff members for this channel
      const staffMembers = await this.#db
        .select({ staffId: channelStaff.staffId })
        .from(channelStaff)
        .where(eq(channelStaff.channelId, request.channelId));

      if (staffMembers.length === 0) {
        log.warn("No staff members found for channel", { channelId: request.channelId });
        return [];
      }

      log.debug("Found staff members for channel", {
        channelId: request.channelId,
        count: staffMembers.length,
      });

      // Create notifications for all staff members
      const notificationsToCreate = staffMembers.map((staff) => ({
        staffId: staff.staffId,
        title: request.title,
        description: request.description,
        isRead: false,
      }));

      const createdNotifications = await this.#db
        .insert(notification)
        .values(notificationsToCreate)
        .returning({ id: notification.id });

      log.info("Created notifications for channel", {
        channelId: request.channelId,
        count: createdNotifications.length,
      });

      return createdNotifications.map((n) => n.id);
    } catch (error) {
      log.error("Failed to create notification", {
        channelId: request.channelId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Get all notifications for a staff member
   * @param staffId The ID of the staff member
   * @returns Array of notifications
   */
  async getNotificationsForStaff(staffId: string): Promise<SelectNotification[]> {
    const log = logger.setContext("NotificationService.getNotificationsForStaff");
    log.debug("Getting notifications for staff", { staffId });

    if (!this.#db) {
      log.error("Database connection not initialized");
      throw new Error("Database connection not initialized");
    }

    try {
      const notifications = await this.#db
        .select()
        .from(notification)
        .where(eq(notification.staffId, staffId));

      log.debug("Retrieved notifications for staff", {
        staffId,
        count: notifications.length,
      });

      return notifications;
    } catch (error) {
      log.error("Failed to get notifications for staff", {
        staffId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Check if a staff member has unread notifications
   * @param staffId The ID of the staff member
   * @returns True if there are unread notifications
   */
  async hasUnreadNotifications(staffId: string): Promise<boolean> {
    const log = logger.setContext("NotificationService.hasUnreadNotifications");
    log.debug("Checking for unread notifications", { staffId });

    if (!this.#db) {
      log.error("Database connection not initialized");
      throw new Error("Database connection not initialized");
    }

    try {
      const unreadNotifications = await this.#db
        .select({ id: notification.id })
        .from(notification)
        .where(and(eq(notification.staffId, staffId), eq(notification.isRead, false)))
        .limit(1);

      const hasUnread = unreadNotifications.length > 0;

      log.debug("Checked unread notifications", {
        staffId,
        hasUnread,
      });

      return hasUnread;
    } catch (error) {
      log.error("Failed to check unread notifications", {
        staffId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Delete a specific notification
   * @param notificationId The ID of the notification to delete
   * @param staffId The ID of the staff member (ownership check)
   * @throws NotFoundError if notification not found
   */
  async deleteNotification(notificationId: string, staffId: string): Promise<void> {
    const log = logger.setContext("NotificationService.deleteNotification");
    log.debug("Deleting notification", { notificationId, staffId });

    if (!this.#db) {
      log.error("Database connection not initialized");
      throw new Error("Database connection not initialized");
    }

    try {
      await this.#db
        .delete(notification)
        .where(and(eq(notification.id, notificationId), eq(notification.staffId, staffId)));

      log.info("Deleted notification", { notificationId, staffId });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      log.error("Failed to delete notification", {
        notificationId,
        staffId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Mark a notification as read
   * @param notificationId The ID of the notification to mark as read
   * @param staffId The ID of the staff member (ownership check)
   * @throws NotFoundError if notification not found
   */
  async markAsRead(notificationId: string, staffId: string): Promise<void> {
    const log = logger.setContext("NotificationService.markAsRead");
    log.debug("Marking notification as read", { notificationId, staffId });

    if (!this.#db) {
      log.error("Database connection not initialized");
      throw new Error("Database connection not initialized");
    }

    try {
      // First check if notification exists and belongs to staff member
      const existing = await this.#db
        .select()
        .from(notification)
        .where(and(eq(notification.id, notificationId), eq(notification.staffId, staffId)))
        .limit(1);

      if (existing.length === 0) {
        log.warn("Notification not found", { notificationId });
        throw new NotFoundError("Notification not found");
      }

      await this.#db
        .update(notification)
        .set({ isRead: true })
        .where(eq(notification.id, notificationId));

      log.info("Marked notification as read", { notificationId, staffId });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      log.error("Failed to mark notification as read", {
        notificationId,
        staffId,
        error: String(error),
      });
      throw error;
    }
  }

  /**
   * Delete all notifications for a staff member
   * @param staffId The ID of the staff member
   * @param readOnly If true, only delete read notifications
   * @returns Number of deleted notifications
   */
  async deleteAllNotifications(staffId: string, readOnly: boolean = false): Promise<number> {
    const log = logger.setContext("NotificationService.deleteAllNotifications");
    log.debug("Deleting all notifications for staff", { staffId, readOnly });

    if (!this.#db) {
      log.error("Database connection not initialized");
      throw new Error("Database connection not initialized");
    }

    try {
      const whereCondition = readOnly
        ? and(eq(notification.staffId, staffId), eq(notification.isRead, true))
        : eq(notification.staffId, staffId);

      const deleted = await this.#db
        .delete(notification)
        .where(whereCondition)
        .returning({ id: notification.id });

      log.info("Deleted notifications for staff", {
        staffId,
        readOnly,
        count: deleted.length,
      });

      return deleted.length;
    } catch (error) {
      log.error("Failed to delete notifications", {
        staffId,
        readOnly,
        error: String(error),
      });
      throw error;
    }
  }
}
