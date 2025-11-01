import * as functions from 'firebase-functions/v2';
export declare const backfillUserMsgCount: functions.https.CallableFunction<any, Promise<{
    ok: boolean;
    users: number;
    totalMessages: number;
    processedRooms: number;
}>>;
//# sourceMappingURL=backfillUserMsgCount.d.ts.map