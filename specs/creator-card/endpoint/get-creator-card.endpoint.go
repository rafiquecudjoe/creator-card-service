GetCreatorCardRequest {
  path /creator-cards/:slug
  method GET

  // Optional access code for private cards, supplied as a query parameter.
  query {
    access_code? string<length:6>
  }

  // access_code is OMITTED ENTIRELY from the retrieval response.
  response.ok {
    http.code 200
    status success
    message "Creator Card Retrieved Successfully."
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
      created number
      updated number
      deleted? number
    }
  }

  // Access-control ladder (first match wins).
  response.error {
    http.code 404
    status error
    code string // NF01 (not found / deleted) or NF02 (draft)
    message "Creator card not found"
  }

  response.error {
    http.code 403
    status error
    code string // AC03 (no access_code) or AC04 (wrong access_code)
    message string
  }
}
