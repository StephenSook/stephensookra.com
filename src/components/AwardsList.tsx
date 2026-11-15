import type { Award } from "@/content";

export function AwardsList({ awards }: { awards: Award[] }) {
  return (
    <ul className="awards">
      {awards.map((award, i) => (
        <li key={`${award.event}-${award.prize}-${i}`} className="awards__item">
          <span className="awards__prize">{award.prize}</span>
          <span className="awards__where">{award.project ? `${award.event}, ${award.project}` : award.event}</span>
        </li>
      ))}
    </ul>
  );
}
