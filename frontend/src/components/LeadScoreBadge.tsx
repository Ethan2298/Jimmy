interface LeadScoreBadgeProps {
  score: number;
}

export default function LeadScoreBadge({ score }: LeadScoreBadgeProps) {
  let colorClass = 'bg-red-700 text-red-200';
  if (score >= 7) {
    colorClass = 'bg-green-700 text-green-200';
  } else if (score >= 4) {
    colorClass = 'bg-amber-700 text-amber-200';
  }

  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${colorClass}`}>
      {score}
    </span>
  );
}
