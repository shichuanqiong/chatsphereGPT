import * as functions from 'firebase-functions/v2';
export declare const onMessageCreate: functions.CloudFunction<functions.database.DatabaseEvent<functions.firestore.Change<functions.database.DataSnapshot>, {
    roomId: string;
    msgId: string;
}>>;
export declare const onMessageDelete: functions.CloudFunction<functions.database.DatabaseEvent<functions.firestore.Change<functions.database.DataSnapshot>, {
    roomId: string;
    msgId: string;
}>>;
//# sourceMappingURL=onMessageCounters.d.ts.map