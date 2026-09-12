export interface Project {
  slug: string;
  title: string;
  category: string;
  tagline: string;
  description: string;
  year: string;
  /** Optional real screenshot. Falls back to an art-directed gradient visual. */
  image?: string;
  /** Gradient identity used for placeholder visuals and accents. */
  palette: {
    from: string;
    to: string;
    glow: string;
  };
  technologies: string[];
  overview: string;
  challenge: string;
  solution: string;
  features: string[];
  results: string[];
  external?: string;
  featured?: boolean;
}

export interface Service {
  index: string;
  title: string;
  description: string;
  tags: string[];
}

export interface ProcessStep {
  index: string;
  title: string;
  description: string;
}

export interface TechGroup {
  label: string;
  items: string[];
}