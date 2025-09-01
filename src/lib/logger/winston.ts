import winston from "winston";
import { dev } from "$app/environment";

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (stack) {
      log += `\n${stack}`;
    }

    if (Object.keys(meta).length > 0) {
      log += `\n${JSON.stringify(meta, null, 2)}`;
    }

    return log;
  }),
);

const logger = winston.createLogger({
  level: dev ? "debug" : "info",
  format: customFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(customFormat),
    }),
  ],
});

export default logger;
