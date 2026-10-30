// Shared copy and links. English only for now; Swedish and Spanish dictionaries will sit next to this file.

export const SITE_URL = 'https://posmitny.com';

export const HOME = {
  title: 'André Posmitny · Product builder',
  description: 'André Posmitny is a product builder and founder. He takes products from a rough idea to something that works and people actually use. Building Vanclaro Agents and Brizzy.',
} as const;

export const NAV = [
  { href: '/', label: 'Work' },
  { href: '/fun', label: 'Fun' },
  { href: '/me', label: 'Me' },
] as const;

export const LINKS = {
  email: 'andre@posmitny.com',
  cal: 'https://cal.com/andre-posmitny/15min',
  vasyl: 'https://vasylposmit.com/',
  linkedin: 'https://www.linkedin.com/in/andr%C3%A9-posmitny-97b784b7/',
  instagram: 'https://www.instagram.com/andrefollowthesun/',
  boosin: 'https://www.instagram.com/boosinmusic/',
  vanclaro: 'https://vanclaro.com',
  brizzy: 'https://brizzy.app',
} as const;

export const FOOTER = {
  tagline: 'Follow the sun.',
  blurb: 'Product builder and founder. Building Vanclaro Agents and Brizzy.',
  copyright: '© 2026 André Posmitny',
} as const;
