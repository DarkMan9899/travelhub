/**
 * Auth module Controller.
 *
 * Implements BACKEND_ARCHITECTURE.md Ch.5: parse input -> build DTO ->
 * call Service -> shape response. The web-client refresh-token cookie
 * (`FRONTEND_ARCHITECTURE.md` §34.1) is set/cleared HERE, never in the
 * Service — delivery mechanics (cookies, headers) are an HTTP/Controller
 * concern; the Service only ever returns plain data.
 *
 * `X-Client: web` is this codebase's convention for "this request came
 * from the browser app" (apps/web is still Sprint-1 scaffold — no
 * concrete header value exists yet to match against, so this is
 * documented here as the value apps/web's Axios instance should send,
 * `FRONTEND_ARCHITECTURE.md` §10.1).
 */

import { decodeToken } from '../../../core/domain/tokenService.js';
import { toAuthResponseDto, toPrincipalDto } from '../dto/authDto.js';

const REFRESH_COOKIE_NAME = 'refresh_token';

function isWebClient(req) {
  return req.headers['x-client'] === 'web';
}

function buildContext(req) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    deviceLabel: req.headers['x-client'] || req.headers['user-agent'] || null,
    requestId: req.requestId,
  };
}

function setRefreshCookie(req, res, refreshToken) {
  if (!isWebClient(req)) return;
  const { exp } = decodeToken(refreshToken);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    expires: new Date(exp * 1000),
  });
}

function readRefreshToken(req) {
  return req.body?.refresh_token || req.cookies?.[REFRESH_COOKIE_NAME] || null;
}

export function createAuthController(authenticationService) {
  return {
    async register(req, res, next) {
      try {
        const result = await authenticationService.register(
          req.validated.body,
          buildContext(req),
        );
        setRefreshCookie(req, res, result.refreshToken);
        res.status(201).json({
          success: true,
          data: toAuthResponseDto(result),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async login(req, res, next) {
      try {
        const result = await authenticationService.login(
          req.validated.body,
          buildContext(req),
        );
        setRefreshCookie(req, res, result.refreshToken);
        res.status(200).json({
          success: true,
          data: toAuthResponseDto(result),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async refresh(req, res, next) {
      try {
        const refreshToken =
          req.validated.body.refresh_token || readRefreshToken(req);
        const result = await authenticationService.refresh(
          refreshToken,
          buildContext(req),
        );
        setRefreshCookie(req, res, result.refreshToken);
        res.status(200).json({
          success: true,
          data: {
            access_token: result.accessToken,
            refresh_token: result.refreshToken,
          },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async logout(req, res, next) {
      try {
        const refreshToken = readRefreshToken(req);
        const result = await authenticationService.logout(
          refreshToken,
          buildContext(req),
        );
        if (isWebClient(req)) res.clearCookie(REFRESH_COOKIE_NAME);
        res
          .status(200)
          .json({ success: true, data: result, meta: null, error: null });
      } catch (err) {
        next(err);
      }
    },

    async logoutAll(req, res, next) {
      try {
        const { revokedCount } = await authenticationService.logoutAll(
          req.principal.userId,
          buildContext(req),
        );
        if (isWebClient(req)) res.clearCookie(REFRESH_COOKIE_NAME);
        res.status(200).json({
          success: true,
          data: { revoked_count: revokedCount },
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },

    async me(req, res, next) {
      try {
        const result = await authenticationService.getPrincipal(
          req.principal.userId,
        );
        res.status(200).json({
          success: true,
          data: toPrincipalDto(result),
          meta: null,
          error: null,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

export default createAuthController;
