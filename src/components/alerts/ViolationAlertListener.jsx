import { useViolationAlerts } from "../../hooks/useViolationAlerts";

/** Mount once under ToastProvider to receive WS safety alerts app-wide. */
export function ViolationAlertListener() {
  useViolationAlerts();
  return null;
}
