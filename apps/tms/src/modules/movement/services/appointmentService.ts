import { db } from "@qubere/db";
import type { AccountContext } from "@qubere/auth";
import { publishTransportationEvent } from "../../events/services/eventService";

export interface ScheduleAppointmentInput {
  movementStopId: string;
  appointmentStart: Date;
  appointmentEnd: Date;
  locationName?: string;
  unlocode?: string;
}

export async function scheduleAppointment(ctx: AccountContext, input: ScheduleAppointmentInput) {
  const stop = await db.movementStop.findFirst({
    where: {
      accountId: ctx.accountId,
      id: input.movementStopId,
    },
  });

  if (!stop) {
    throw new Error(`MovementStop ${input.movementStopId} not found.`);
  }

  const updatedStop = await db.movementStop.update({
    where: { id: stop.id },
    data: {
      status: "CONFIRMED",
      appointmentStart: input.appointmentStart,
      appointmentEnd: input.appointmentEnd,
      locationName: input.locationName ?? stop.locationName,
      unlocode: input.unlocode ?? stop.unlocode,
    },
  });

  await publishTransportationEvent(ctx, {
    entityType: "MOVEMENT",
    entityId: stop.movementId,
    eventType: "APPOINTMENT_SCHEDULED",
    source: "SYSTEM",
    payload: {
      movementStopId: stop.id,
      appointmentStart: input.appointmentStart,
      appointmentEnd: input.appointmentEnd,
      locationName: updatedStop.locationName,
      unlocode: updatedStop.unlocode,
    },
  });

  return updatedStop;
}
