// Common fields shared across models
// These can be imported and spread into model definitions using ...common

common {
  created number // Unix epoch milliseconds (auto-set on create)
  updated number // Unix epoch milliseconds (auto-set on create)
  deleted? number // Soft-delete timestamp; 0 while live, ms timestamp once deleted
}
