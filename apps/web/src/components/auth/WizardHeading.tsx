interface Props {
  plain: string;
  highlight: string;
  sub?: string;
}

/** "CREATE YOUR **ACCOUNT**" style heading with gold highlight + underline. */
export default function WizardHeading({ plain, highlight, sub }: Props) {
  return (
    <div className="text-center">
      <h2
        className="font-black uppercase leading-tight text-[30px] sm:text-[40px] tracking-wide"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <span className="text-kink-cream">{plain} </span>
        <span className="text-kink-gold">{highlight}</span>
      </h2>
      <div className="mx-auto mt-3 h-px w-40 bg-gradient-to-r from-transparent via-kink-amber/70 to-transparent" />
      {sub && <p className="mt-3 text-[15px] text-kink-dim">{sub}</p>}
    </div>
  );
}
