import {
  AFFILIATE_AUDIENCE_LABELS,
  AFFILIATE_PRIMARY_CHANNEL_LABELS,
} from "@/lib/affiliate/validateAffiliateApplication";

export type AffiliateApplicationDetailsData = {
  legalName: string | null;
  companyName: string | null;
  country: string | null;
  primaryChannel: string | null;
  audienceSize: string | null;
  promoMethods: string | null;
  socialLinks: string | null;
  websiteUrl: string | null;
  notes: string | null;
  submittedAt: string | null;
  denialReason: string | null;
  contactEmail: string | null;
  contactDiscord: string | null;
  contactX: string | null;
  contactOther: string | null;
};

export function AffiliateApplicationDetails({
  email,
  application,
}: {
  email: string;
  application: AffiliateApplicationDetailsData;
}) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-zinc-500">Legal name</dt>
        <dd className="font-medium text-zinc-900">{application.legalName ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">Company</dt>
        <dd className="font-medium text-zinc-900">{application.companyName ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">Country</dt>
        <dd className="font-medium text-zinc-900">{application.country ?? "—"}</dd>
      </div>
      <div>
        <dt className="text-zinc-500">Channel</dt>
        <dd className="font-medium text-zinc-900">
          {application.primaryChannel
            ? (AFFILIATE_PRIMARY_CHANNEL_LABELS[application.primaryChannel] ??
              application.primaryChannel)
            : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-500">Audience</dt>
        <dd className="font-medium text-zinc-900">
          {application.audienceSize
            ? (AFFILIATE_AUDIENCE_LABELS[application.audienceSize] ?? application.audienceSize)
            : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-zinc-500">Website</dt>
        <dd className="break-all font-medium text-zinc-900">{application.websiteUrl ?? "—"}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-zinc-500">Promotion plan</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-800">{application.promoMethods ?? "—"}</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-zinc-500">Social links</dt>
        <dd className="mt-1 whitespace-pre-wrap text-zinc-800">{application.socialLinks ?? "—"}</dd>
      </div>
      {application.notes ? (
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Applicant notes</dt>
          <dd className="mt-1 whitespace-pre-wrap text-zinc-800">{application.notes}</dd>
        </div>
      ) : null}
      <div className="sm:col-span-2">
        <dt className="text-zinc-500">Contact methods</dt>
        <dd className="mt-1 space-y-1 text-zinc-800">
          <p>
            <span className="text-zinc-500">Login email:</span> {email}
          </p>
          {application.contactEmail ? (
            <p>
              <span className="text-zinc-500">Contact email:</span> {application.contactEmail}
            </p>
          ) : null}
          {application.contactDiscord ? (
            <p>
              <span className="text-zinc-500">Discord:</span> {application.contactDiscord}
            </p>
          ) : null}
          {application.contactX ? (
            <p>
              <span className="text-zinc-500">X:</span> {application.contactX}
            </p>
          ) : null}
          {application.contactOther ? (
            <p>
              <span className="text-zinc-500">Other:</span> {application.contactOther}
            </p>
          ) : null}
        </dd>
      </div>
      {application.denialReason ? (
        <div className="sm:col-span-2">
          <dt className="text-zinc-500">Denial reason (shown to applicant)</dt>
          <dd className="mt-1 whitespace-pre-wrap text-red-900">{application.denialReason}</dd>
        </div>
      ) : null}
    </dl>
  );
}
