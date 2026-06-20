CreateCreatorCardRequest {
  path /creator-cards
  method POST

  body {
    title string<trim|minLength:3|maxLength:100>
    description? string<trim|maxLength:500>
    slug? string<trim|minLength:5|maxLength:50>
    creator_reference string<length:20>
    links[]? {
      title string<trim|minLength:1|maxLength:100>
      url string<trim|maxLength:200>
    }
    service_rates? {
      currency string(NGN|USD|GBP|GHS)
      rates[] {
        name string<trim|minLength:3|maxLength:100>
        description? string<trim|maxLength:250>
        amount number<min:1>
      }
    }
    status string(draft|published)
    access_type? string(public|private)
    access_code? string<length:6>
  }

  // access_code is INCLUDED in the create response.
  response.ok {
    http.code 200
    status success
    message "Creator Card Created Successfully."
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
      deleted? number
    }
  }

  // Custom business errors (field-level validation failures also return http.code 400 with no code).
  response.error {
    http.code 400
    status error
    // code is one of: SL02 (slug taken), AC01 (access_code required), AC05 (access_code on public)
    code string
    message string
  }
}
