import axios from 'axios';
import { Holiday } from '../types';

const HOLIDAY_API_URL = 'https://raw.githubusercontent.com/guangrei/APIHariLibur_V2/main/calendar.json';

interface HolidayCache {
    data: Record<string, any>;
    timestamp: number;
}

class HolidayService {
    private cache: HolidayCache | null = null;
    private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

    private async fetchAllHolidays(): Promise<Record<string, any>> {
        // Check cache validity
        if (this.cache && Date.now() - this.cache.timestamp < this.cacheTTL) {
            // Using cached holidays
            return this.cache.data;
        }

        try {
            // Fetching holidays from API
            const response = await axios.get(HOLIDAY_API_URL, { timeout: 15000 });

            this.cache = {
                data: response.data,
                timestamp: Date.now(),
            };

            // Holidays fetched and cached
            return response.data;
        } catch (error) {
            console.error('[Holiday] Failed to fetch holidays:', error);

            // Return cache even if expired, or empty object
            return this.cache?.data || {};
        }
    }

    async getHolidaysForYear(year: number): Promise<Holiday[]> {
        const allHolidays = await this.fetchAllHolidays();
        const yearHolidays: Holiday[] = [];

        for (const [date, data] of Object.entries(allHolidays)) {
            if (date.startsWith(String(year))) {
                const summary = (data as any).summary || ['Unknown'];
                const description = (data as any).description || [''];

                yearHolidays.push({
                    date,
                    name: Array.isArray(summary) ? summary[0] : summary,
                    description: Array.isArray(description) ? description[0] : description,
                    is_national_holiday: (data as any).holiday || false,
                });
            }
        }

        // Sort by date
        yearHolidays.sort((a, b) => a.date.localeCompare(b.date));

        // Holidays for year processed
        return yearHolidays;
    }

    async getHolidaysForMonth(year: number, month: number): Promise<Holiday[]> {
        const allHolidays = await this.fetchAllHolidays();
        const monthStr = `${year}-${String(month).padStart(2, '0')}`;
        const monthHolidays: Holiday[] = [];

        for (const [date, data] of Object.entries(allHolidays)) {
            if (date.startsWith(monthStr)) {
                const summary = (data as any).summary || ['Unknown'];
                const description = (data as any).description || [''];

                monthHolidays.push({
                    date,
                    name: Array.isArray(summary) ? summary[0] : summary,
                    description: Array.isArray(description) ? description[0] : description,
                    is_national_holiday: (data as any).holiday || false,
                });
            }
        }

        monthHolidays.sort((a, b) => a.date.localeCompare(b.date));
        return monthHolidays;
    }

    async isHoliday(dateStr: string): Promise<Holiday | null> {
        const allHolidays = await this.fetchAllHolidays();
        const data = allHolidays[dateStr];

        if (!data) return null;

        const summary = data.summary || ['Unknown'];
        const description = data.description || [''];

        return {
            date: dateStr,
            name: Array.isArray(summary) ? summary[0] : summary,
            description: Array.isArray(description) ? description[0] : description,
            is_national_holiday: data.holiday || false,
        };
    }
}

export const holidayService = new HolidayService();
