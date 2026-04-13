export const toLocalDateString = (date: Date | string): string => {
  if (!date) return '';
  
  // If it's already a YYYY-MM-DD string, just return it
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
  }

  let dateObj = date;
  if (typeof date === 'string') {
      // Replace space with T for better cross-browser compatibility with PocketBase dates
      dateObj = date.replace(' ', 'T');
  }

  const d = new Date(dateObj);
  if (isNaN(d.getTime())) return '';
  
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const formatLocalDate = (dateString: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string => {
  if (!dateString) return '';
  
  let d: Date;
  if (typeof dateString === 'string') {
      // If it's just YYYY-MM-DD, force local parsing by adding T00:00:00
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          d = new Date(`${dateString}T00:00:00`);
      } else {
          d = new Date(dateString.replace(' ', 'T'));
      }
  } else {
      d = dateString;
  }

  if (isNaN(d.getTime())) return '';
  
  if (options) {
      return d.toLocaleDateString('es-ES', options);
  }
  
  return d.toLocaleDateString('es-ES');
};

export const fromLocalDateString = (dateString: string | null | undefined): string => {
  if (!dateString) return '';
  // Adding T00:00:00 forces Date to parse it as local time instead of UTC
  const d = new Date(`${dateString}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
};

export const getLocalDayStartUTC = (dateString: string): string => {
  if (!dateString) return '';
  const d = new Date(`${dateString}T00:00:00`);
  return d.toISOString().replace('T', ' ').replace('Z', '');
};

export const getLocalDayEndUTC = (dateString: string): string => {
  if (!dateString) return '';
  const d = new Date(`${dateString}T23:59:59.999`);
  return d.toISOString().replace('T', ' ').replace('Z', '');
};
