import { journeySteps } from "./home-content";
export function HomeJourney() {
  return (
    <section
      id="how-it-works"
      className="home-journey"
      data-node-id="28:711"
      aria-labelledby="journey-title"
    >
      <div className="home-journey-intro">
        <h2 id="journey-title" className="text-home-section">
          Less guesswork.
        </h2>
        <p className="font-editorial text-home-serif italic text-primary">
          More belonging.
        </p>
        <p className="text-muted">
          From the first search to the next step, our team helps you understand
          the process.
        </p>
      </div>
      <ol className="home-journey-steps">
        {journeySteps.map((step) => (
          <li key={step.number}>
            <span className="text-home-card text-primary">{step.number}</span>
            <div>
              <h3 className="text-home-card">{step.title}</h3>
              <p className="text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
