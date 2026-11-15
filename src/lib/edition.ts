/** Which build this is: the hosted site (default) or the Mac app
    (NEXT_PUBLIC_EDITION=desktop, a static export served by desktop/).
    Modules that differ live in src/edition/{hosted,desktop}/ and are
    imported as @edition/<name>; next.config.ts points the alias. */
export const IS_DESKTOP = process.env.NEXT_PUBLIC_EDITION === "desktop";

/** The desktop's only user: rows need a user_id, and there is one person. */
export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
