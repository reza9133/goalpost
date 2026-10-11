import { SCENARIOS } from '../lib/scenarios';
import { RedlinePair } from './Redline';

// A real excerpt pair from the bundled Meridian demonstration documents.
const PLEDGED = SCENARIOS[0]?.elements[0]?.quote ?? '';
const REPORTED =
  'We will cut our emissions intensity of Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2035, measured against our 2022 baseline.';

export function HeroFigure() {
  return (
    <figure className="hero__figure">
      <figcaption className="hero__caption">One promise, as pledged and as later reported</figcaption>
      <div className="rule" aria-hidden="true">
        <span className="rule__line" />
        <span className="rule__post rule__post--pledged">
          <span className="rule__label">Pledged</span>
        </span>
        <span className="rule__post rule__post--moved">
          <span className="rule__label">Reported</span>
        </span>
      </div>
      <RedlinePair pledged={PLEDGED} reported={REPORTED} pledgedLabel="Pledge, March 2025" reportedLabel="Report, April 2026" />
    </figure>
  );
}
