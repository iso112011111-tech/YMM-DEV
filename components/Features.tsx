import { FEATURES } from "@/data/siteData";

export default function Features() {
  return (
    <section className="features shell" aria-label="จุดเด่นของ YMM-DEV">
      {FEATURES.map((feature) => (
        <article className="feature" key={feature.title}>
          <span className="feature-icon" aria-hidden="true">
            {feature.icon}
          </span>
          <div>
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
