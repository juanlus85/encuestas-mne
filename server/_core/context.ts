import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../../drizzle/schema";
import { getStudies, getStudyById, getUserStudyMemberships } from "../db";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  activeStudyId: number | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  let activeStudyId: number | null = null;

  if (user?.id) {
    const parsedCookies = parseCookieHeader(opts.req.headers.cookie ?? "");
    const explicitStudy = Number(
      (opts.req.headers["x-study-id"] as string | undefined)
      ?? parsedCookies.activeStudyId
      ?? opts.req.query?.studyId,
    );

    const memberships = await getUserStudyMemberships(user.id);

    if (user.platformRole === "supervisor") {
      if (Number.isFinite(explicitStudy)) {
        const selectedStudy = await getStudyById(explicitStudy);
        if (selectedStudy) {
          activeStudyId = selectedStudy.id;
        }
      }

      if (!activeStudyId) {
        const allStudies = await getStudies();
        activeStudyId = allStudies[0]?.id ?? null;
      }
    } else if (Number.isFinite(explicitStudy) && memberships.some((row) => row.study.id === explicitStudy)) {
      activeStudyId = explicitStudy;
    } else if (memberships.length > 0) {
      activeStudyId = memberships[0].study.id;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    activeStudyId,
  };
}
