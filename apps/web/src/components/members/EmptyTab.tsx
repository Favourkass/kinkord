export interface EmptyTabProps {
  title: string;
  body: string;
}

/** Placeholder for profile tabs whose feature hasn't shipped yet (Posts, Media, Friends). */
export default function EmptyTab({ title, body }: EmptyTabProps) {
  return (
    <div className="mx-auto w-full max-w-[600px] px-[16px] pt-[40px] text-center">
      <p className="text-[18px] font-bold text-app-text">{title}</p>
      <p className="pt-[6px] text-[14px] text-app-subtle">{body}</p>
    </div>
  );
}
