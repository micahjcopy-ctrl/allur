// Back-compat shim. Email now goes through the provider-agnostic SMTP sender in
// ./email.ts (the Replit Gmail connector is no longer used).
export { sendEmail, sendEmail as sendGmail } from "./email";
