# Date and Time

We are adjusting for date and time differences between clients and tenants.

We are also adjusting for daylight saving, meaning we are not shifting times, when they usually shift due to daylight saving. We are doing this because organizations adjust their appointment schedules according to daylight saving as well (a 9am appointment will always be at 9am).

We are following these priciples:

- The Back-End only ever handles UTC times.
- When working with schedules we are displaying local time without daylight saving adjustments.
- Once we create an appointment, we save it using the respective date and time in UTC.
- Once we display appointments, we convert from UTC to local time incl. daylight saving adjustments.

## How it works

> This currently only works for the northern himsphere because we use January as a reference date (see `const jan = new Date`).

1. Our Back-End will only every take and return dates using UTC (no daylight saving there)
1. When managing slots for channels
   - we will show times without adjusting for daylight saving
   - we will save times without adjusting for daylight saving
1. When booking appointments
   - we will show time in local time (with or without daylight saving for the respective date)
   - we will save appointments using UTC (effectivly not touching the time during booking process)
1. When looking a appointments in the calendar we will show local time (with or without daylight saving).
1. Client Dashboard converts to localtime (with or without daylight saving).
1. E-Mails going out about appointments include the timezone of the user, so the proper time can be shown.
