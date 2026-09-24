import type { RequestWithSession } from "../authenticated-request";

export function regenerateSession(request: RequestWithSession): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error: unknown) => {
      if (error instanceof Error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function saveSession(request: RequestWithSession): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error: unknown) => {
      if (error instanceof Error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export function destroySession(request: RequestWithSession): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.destroy((error: unknown) => {
      if (error instanceof Error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
