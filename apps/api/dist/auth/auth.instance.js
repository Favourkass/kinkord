"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH = void 0;
exports.buildAuth = buildAuth;
const better_auth_1 = require("better-auth");
const drizzle_1 = require("better-auth/adapters/drizzle");
const api_1 = require("better-auth/api");
const plugins_1 = require("better-auth/plugins");
const schema = __importStar(require("../db/schema"));
const templates_1 = require("../email/templates");
exports.AUTH = Symbol("AUTH");
function buildAuth(db, email) {
    const webOrigins = (process.env.WEB_ORIGINS ?? "http://localhost:3000")
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
    return (0, better_auth_1.betterAuth)({
        baseURL: process.env.AUTH_BASE_URL ?? "http://localhost:4000",
        basePath: "/api/auth",
        secret: process.env.AUTH_SECRET,
        trustedOrigins: webOrigins,
        database: (0, drizzle_1.drizzleAdapter)(db, {
            provider: "pg",
            schema: {
                user: schema.user,
                session: schema.session,
                account: schema.account,
                verification: schema.verification,
                twoFactor: schema.twoFactor,
            },
        }),
        plugins: [
            (0, plugins_1.username)({ minUsernameLength: 3, maxUsernameLength: 30 }),
            (0, plugins_1.twoFactor)({ issuer: "Kinkord" }),
        ],
        user: {
            additionalFields: {
                ageAttested: { type: "boolean", required: true, input: true },
            },
        },
        databaseHooks: {
            user: {
                create: {
                    before: async (u) => {
                        if (!u.ageAttested) {
                            throw new api_1.APIError("BAD_REQUEST", {
                                message: "You must confirm you are 18 or older to create an account.",
                            });
                        }
                        return { data: u };
                    },
                    after: async (u) => {
                        await db
                            .insert(schema.profile)
                            .values({ userId: u.id, displayName: u.name })
                            .onConflictDoNothing();
                    },
                },
            },
        },
        emailAndPassword: {
            enabled: true,
            minPasswordLength: 10,
            requireEmailVerification: false,
            sendResetPassword: async ({ user, url }) => {
                const t = (0, templates_1.resetPasswordEmail)(url);
                await email.send({ to: user.email, ...t });
            },
        },
        emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: true,
            sendVerificationEmail: async ({ user, url }) => {
                const link = new URL(url);
                link.searchParams.set("callbackURL", `${webOrigins[0]}/verify-email`);
                const t = (0, templates_1.verificationEmail)(link.toString());
                await email.send({ to: user.email, ...t });
            },
        },
        advanced: {
            ...(process.env.COOKIE_DOMAIN
                ? {
                    crossSubDomainCookies: { enabled: true, domain: process.env.COOKIE_DOMAIN },
                }
                : {}),
        },
        rateLimit: { enabled: true },
    });
}
//# sourceMappingURL=auth.instance.js.map