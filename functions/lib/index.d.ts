import * as functions from 'firebase-functions/v2';
import { onMessageCreate, onMessageDelete } from './onMessageCounters';
import { backfillUserMsgCount } from './tools/backfillUserMsgCount';
export declare const aggregateMetrics: functions.scheduler.ScheduleFunction;
export declare const updateOnlineCount: functions.scheduler.ScheduleFunction;
export declare const calculateDailyActiveUsers: functions.scheduler.ScheduleFunction;
export declare const api: functions.https.HttpsFunction;
export { onMessageCreate, onMessageDelete };
export { backfillUserMsgCount };
//# sourceMappingURL=index.d.ts.map