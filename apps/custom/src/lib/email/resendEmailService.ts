import { PlatformEmailService, type TaskAssignmentNotificationOptions } from "./platformEmailService";

export type TaskAssignmentEmailParams = TaskAssignmentNotificationOptions;

export async function sendTaskAssignedEmail(params: TaskAssignmentNotificationOptions) {
  return PlatformEmailService.sendTaskAssignmentNotification(params);
}

export { PlatformEmailService };
