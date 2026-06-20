import ../commons.go

CreatorCard {
  _id string<isUnique|indexed> // Unique identifier (ULID); stored as _id, exposed as id
  title string // Card title, 3-100 chars
  description? string // Creator bio, max 500 chars
  slug string<isUnique|indexed> // Public URL identifier, 5-50 chars [a-zA-Z0-9_-], auto-generated when omitted
  creator_reference string<indexed> // Owner identity on the consuming service, exactly 20 chars

  // Showcase links
  links[]? {
    title string // Link title, 1-100 chars
    url string // Link URL, http(s) only, max 200 chars
  }

  // Pricing block; when present, currency applies to every rate
  service_rates? {
    currency string // One of NGN, USD, GBP, GHS
    rates[] {
      name string // Rate name, 3-100 chars
      description? string // Rate description, max 250 chars
      amount number // Positive integer in minor units (no decimals/negatives/zero)
    }
  }

  status string<indexed> // draft | published (drafts are never publicly retrievable)
  access_type string // public | private (defaults to public)
  access_code? string // Exactly 6 alphanumeric chars; required iff access_type is private

  ...common // Spread created, updated, deleted
}
