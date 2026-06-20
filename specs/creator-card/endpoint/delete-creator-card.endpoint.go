DeleteCreatorCardRequest {
  path /creator-cards/:slug
  method DELETE

  body {
    creator_reference string<length:20>
  }

  // Soft-deletes the card. access_code is INCLUDED and deleted is the soft-delete timestamp.
  response.ok {
    http.code 200
    status success
    message "Creator Card Deleted Successfully."
    data {
      id string<length:26>
      title string
      description? string
      slug string
      creator_reference string
      links[] {
        title string
        url string
      }
      service_rates? object
      status string
      access_type string
      access_code? string
      created number
      updated number
      deleted number // populated with the soft-delete timestamp
    }
  }

  // Not found, or creator_reference does not match the card's owner.
  response.error {
    http.code 404
    status error
    code string // NF01
    message "Creator card not found"
  }
}
