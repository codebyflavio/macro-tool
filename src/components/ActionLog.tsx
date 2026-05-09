import { useEffect, useRef } from 'react';

interface ActionLogProps {
  log: string[];
}

export function ActionLog({ log }: ActionLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  return (
    <div className="action-log">
      <div className="action-log-header">
        <span className="action-log-title">Action Log</span>
        <span className="action-log-count">{log.length} entries</span>
      </div>
      <div className="action-log-body">
        {log.length === 0 ? (
          <div className="action-log-empty">No log entries yet. Play a macro to see output.</div>
        ) : (
          log.map((entry, i) => (
            <div key={i} className="action-log-entry">
              {entry}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
