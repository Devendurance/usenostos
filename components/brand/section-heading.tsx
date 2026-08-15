type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description?: string;
  inverse?: boolean;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  inverse = false,
}: SectionHeadingProps) {
  return (
    <div className="max-w-3xl">
      <p className={`eyebrow ${inverse ? "text-white/65" : "text-muted-foreground"}`}>
        {eyebrow}
      </p>
      <h2 className="display mt-4 text-balance text-3xl font-bold leading-[1.05] tracking-[-.04em] sm:text-4xl lg:text-[44px]">
        {title}
      </h2>
      {description ? (
        <p
          className={`mt-5 max-w-2xl text-pretty text-base leading-7 ${
            inverse ? "text-white/72" : "text-muted-foreground"
          }`}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
