
export interface ParsedEvent {
    title: string;
    description: string;
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
}

export const parseIcsContent = (data: string): ParsedEvent[] => {
    const events: ParsedEvent[] = [];
    const lines = data.split(/\r?\n/);
    let currentEvent: Partial<ParsedEvent> | null = null;

    const parseDate = (val: string): string => {
        // Handle values with parameters like DTSTART;VALUE=DATE:20260211
        // or just YYYYMMDD / YYYYMMDDTHHMMSSZ
        const actualVal = val.includes(':') ? val.split(':').pop()! : val;
        const datePart = actualVal.split('T')[0];

        if (datePart.length === 8) {
            return `${datePart.substring(0, 4)}-${datePart.substring(4, 6)}-${datePart.substring(6, 8)}`;
        }
        return datePart;
    };

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        // Handle line folding
        while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
            line += lines[++i].substring(1);
        }

        const upperLine = line.toUpperCase();

        if (upperLine.startsWith('BEGIN:VEVENT')) {
            currentEvent = { title: '', description: '', startDate: '', endDate: '' };
        } else if (upperLine.startsWith('END:VEVENT')) {
            if (currentEvent && currentEvent.title && currentEvent.startDate) {
                // if endDate is missing, use startDate
                if (!currentEvent.endDate) {
                    currentEvent.endDate = currentEvent.startDate;
                }
                events.push(currentEvent as ParsedEvent);
            }
            currentEvent = null;
        } else if (currentEvent) {
            const [keyWithParams, ...rest] = line.split(':');
            const key = keyWithParams.split(';')[0].toUpperCase().trim();
            const val = rest.join(':').trim();

            if (key === 'SUMMARY') {
                currentEvent.title = val;
            } else if (key === 'DESCRIPTION') {
                currentEvent.description = val.replace(/\\n/g, '\n');
            } else if (key === 'DTSTART') {
                currentEvent.startDate = parseDate(line);
            } else if (key === 'DTEND') {
                currentEvent.endDate = parseDate(line);
            }
        }
    }

    return events;
};
