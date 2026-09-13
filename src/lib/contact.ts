export const phone = "0558815053";
export const phoneDisplay = "٠٥٥٨٨١٥٠٥٣";
export const internationalPhone = "966558815053";
export function whatsappUrl(message: string) {
  return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}
