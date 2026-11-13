"use client";

import { useEffect } from "react";

/* Supabase's default invite email signs the invitee in through its own
   /verify and sends them to the site URL with the session (or an error) in
   the #fragment, which servers never see — so wherever they land after the
   redirects, hand the fragment to /invite. */
export function InviteForward() {
  useEffect(() => {
    const { pathname, hash } = window.location;
    if (pathname !== "/invite" && /(^#|&)(type=invite|error_code=)/.test(hash)) window.location.replace(`/invite${hash}`);
  }, []);
  return null;
}
