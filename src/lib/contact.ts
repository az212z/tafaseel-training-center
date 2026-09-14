export const phone = "0558815053";
export const phoneDisplay = "٠٥٥٨٨١٥٠٥٣";
export const internationalPhone = "966558815053";
export const whatsappPhone = "966544552366";
export const whatsappDisplay = "٠٥٤٤٥٥٢٣٦٦";
export function whatsappUrl(message: string) {
  return `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`;
}
