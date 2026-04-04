/**
 * Centralized date formatting utilities
 * All dates in the application should use these functions for consistency
 */

/**
 * Format date to MM/DD/YY format
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date string in MM/DD/YY format
 */
export function formatDate(date: string | Date | number | null | undefined): string {
  if (!date) return 'N/A'
  
  const dateObj = new Date(date)
  
  if (isNaN(dateObj.getTime())) return 'Invalid Date'
  
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const year = String(dateObj.getFullYear()).slice(-2)
  
  return `${month}/${day}/${year}`
}

/**
 * Format date to MM/DD/YY HH:MM format
 * @param date - Date string, Date object, or timestamp
 * @returns Formatted date string with time
 */
export function formatDateTime(date: string | Date | number | null | undefined): string {
  if (!date) return 'N/A'
  
  const dateObj = new Date(date)
  
  if (isNaN(dateObj.getTime())) return 'Invalid Date'
  
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const year = String(dateObj.getFullYear()).slice(-2)
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  
  return `${month}/${day}/${year} ${hours}:${minutes}`
}

/**
 * Format date for S3 folder names (MM-DD-YY)
 * Used in additional file uploads: "additional files-MM-DD-YY"
 */
export function formatDateForS3(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  
  return `${month}-${day}-${year}`
}
