import "server-only";

export const USER_SESSION_COOKIE_NAME = "game_user_session";
export const USER_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;

export function getSessionTokenFromCookieHeader(cookieHeader: string | null) {
  if (cookieHeader === null) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const sessionCookie = cookies.find((cookie) =>
    cookie.startsWith(`${USER_SESSION_COOKIE_NAME}=`),
  );

  if (!sessionCookie) {
    return null;
  }

  const [, value = ""] = sessionCookie.split("=");

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getSessionTokenFromRequest(request: Request) {
  return getSessionTokenFromCookieHeader(request.headers.get("cookie"));
}
