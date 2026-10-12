export type Resident = {
  name: string;
  country: string;
  image: string;
  /** Profile link; cards without one aren't clickable yet. */
  url?: string;
};

export const residents: Resident[] = [
  { name: "Bee Suave", country: "IT", image: "/pictures/residents/beesuave.avif" },
  { name: "biancah", country: "BR", image: "/pictures/residents/biancah.avif" },
  { name: "darbydarby", country: "US", image: "/pictures/residents/darbydarby.avif" },
  { name: "Fodongophon", country: "DE", image: "/pictures/residents/fodongophon.avif" },
  { name: "heatsink", country: "US", image: "/pictures/residents/heatsink.avif" },
  { name: "luca", country: "BR", image: "/pictures/residents/luca.avif" },
  { name: "shweiri", country: "US", image: "/pictures/residents/shweiri.avif" },
  { name: "Sideroom", country: "IN", image: "/pictures/residents/sideroom.avif" },
  { name: "splenda", country: "US", image: "/pictures/residents/splenda.avif" },
];
