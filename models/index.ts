/**
 * Barrel import for every model.
 *
 * Importing this module guarantees all schemas are registered with Mongoose
 * before any `populate()` runs — otherwise a populate on a model that has not
 * been imported yet throws `MissingSchemaError`, which is easy to hit in
 * Next.js where each route only imports what it directly uses.
 */
export { default as User, type IUser } from "./User";
export { default as Guest, type IGuest } from "./Guest";
export { default as Room, type IRoom } from "./Room";
export { default as RoomType, type IRoomType } from "./RoomType";
export { default as Reservation, type IReservation } from "./Reservation";
export { default as Payment, type IPayment } from "./Payment";
export { default as Invoice, type IInvoice } from "./Invoice";
export { default as Staff, type IStaff } from "./Staff";
export {
  default as HousekeepingTask,
  type IHousekeepingTask,
} from "./HousekeepingTask";
export { default as HotelSettings, type IHotelSettings } from "./HotelSettings";
export { default as Counter, nextSequence, nextFormattedNumber } from "./Counter";
