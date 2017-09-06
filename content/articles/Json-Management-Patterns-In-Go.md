---
author: Brandon Okert
tags:
  - go
  - golang
  - json
  - rest
  - validation
  - patterns
description: Patterns for Effective Json Management in Go
title: Json Management Patterns In Go
linktitle: ""
featured: primer.png
featuredpath: /img/Json-Management-Patterns-In-Go/
date: 2016-04-18
type: post
---

Managing Json in Go is not a trivial problem. There are many examples out there of how to decode a simple json document into a struct, but few that answer the questions that inevitably come up:

- How do I provide defaults for fields?
- How do I make a field optional?
- How do I avoid using defaults for certain fields (eg: a user id)?
- How do I prevent pointer maintenance issues down the road?
- How do I validate all this?

Below I've outlined several [Patterns](#patterns) that provide ideomatic, easy to use, and easy to test solutions that provide these [Features](#features). Different [Patterns](#patterns) achieve different [Features](#features) - thus you can pick the solution that is most relevant to your application.

Keep reading to learn about the individual [Features](#features) we'll be covering, or skip right to the [Patterns](#patterns) to learn them as they come up.

# Primer

{{< img-post "" "img/Json-Management-Patterns-In-Go/primer.png" "Primer">}}
A Model is a struct that has meaning in our application - a User, a Scene, a Parcel. Models can be Marshaled into json. Inversely, json can be Unmarshaled into new Models. In all but the most trivial applications, we need to Validate incoming json, which in go is usually done after Unmarshaling.

When Unmarshaling json into a Model, we utilize struct tags to denote the field name. When Marshaling, we use the same tags, as well as a new one to signal whether it should be omitted when empty:

```golang
type Model struct {
  UserId uint `json:"user_id"`
  Address string `json:"address,omitempty"` // if empty, don't encode it at all
}
```

Our desired [Features](#features) dictate how we structure our Models, and how we Marshal, Unmarshal, and Validate them.

# Features

Below I've described each feature in detail. Each Pattern also provides links to these Features.

## Default Fields

```golang
ProductCount uint // required, but zero is a safe default
```
This is a field that is required, but if not provided we're ok with the default value provided by Go.

Defaults in Go come for free - if a field is not present in the source json, a default value (0, "", nil, etc.) will be used. This can be very convenient, but it only works in cases where the default value makes sense (you wouldn't want to provide a default name for a user).

## Custom Default Fields

```golang
FavoriteColor string // a default is ok, but we don't want the empty string
```
This is a field where you want a default value, but not the zero value.

The process is a little more involved than basic default values since we need an in-between step, but we'll see how supporting [Required Non Default Fields](#required-non-default-fields) can give us [Custom Default Fields](#custom-default-fields) for free.

## Optional Fields

```golang
Address *string // not required, but we still want to validate it if it's there
```

This is a field that may or may not be available. If present, we want to validate it, but if not present, we don't want to fail validation.

Github popularized the [method of using pointers for this purpose](https://willnorris.com/2014/05/go-rest-apis-and-pointers), as their default value is nil and there is no such thing as a pointer in json. It adds a bit of overhead, but really there's no way around this - sometimes it's there, sometimes it's not. Validation is more tedious if you're not using [Easy Validation](#easy-validation), as you have to handle both the case where it's present and the case where it's not. For fields that you don't want defaults for, but still want them to be required, use [Required Non Default Fields](#required-non-default-fields) instead.

## Required Non Default Fields

```golang
UserId *uint // it's required, but providing a default doesn't make sense
```

This is a field that is required, but we don't want to provide a default for. Validating it is similar to [Optional Fields](#optional-fields), except the case where it is missing is now invalid.

We can re-use the pointer method from [Optional Fields](#optional-fields), and just change the validation. However, this leaves us with a pointer that will always have a value, which adds unwanted maintenance. We can avoid this completely with [Dereferenced Required Fields](#dereferenced-required-fields).

## Dereferenced Required Fields

```golang
type Request struct {
  UserId *uint // this is a Required Non-Default Field, so it needs a pointer
}

type Model struct {
  UserId uint // but it's not optional, so we don't want the pointer in the model
}
```

This is a meta-feature, wherein we've used a pointer in our struct, but really that pointer should never be nil. By de-referencing it, we save ourselves maintenance and testability headaches down the road.

The idea is to separate the model from the json request that creates it, using intermediate representations. As we'll see, this can make other [Features](#features) like [Custom Default Fields](Custom_Default_Fields) trivial to implement, and it can make partial updates (where any subset of fields may be present) easier to manage down the road.

## Easy Validation

```golang
UserId *uint `validate:"nonzero"`
Age Uint `validate:"min=18"`
```

Easy Validation lets us verify that our models are in a legal state after Unmarshaling, without having to manually verify every field and every case.

In its simplest form, validation can be done manually, thus making it easy to port to any solution. The ideomatic [Go Validator](https://github.com/go-validator/validator) is an alternative to manual validation with many desirable qualities. However, there are a few tricks to making it support [Optional Fields](#optional-fields), and [Required Non Default Fields](#required-non-default-fields). We can simplify it further via the intermediate representations from [Dereferenced Required Fields](#dereferenced-required-fields). 

# Patterns

Each Pattern provides a subset of the above [Features](#features). The Patterns increase in complexity as you go, so you should pick the earliest one that satisfies all your requirements. Most of the more complex Patterns focus on doing more work up front so that maintenance down the road is much easier.

## Pattern 1

Features: [Default Fields]($Default_Fields), [Easy Validation](#easy-validation)

This is our base case pattern with very little maintenance or setup involved. If your api is simple, this is the way to go.

```golang
// model
type User struct {
     Name string    `json:"name"    validate:"nonzero"`
     Age uint       `json:"age"     validate:"min=1"`
     Address string `json:"address" validate:"nonzero"`
}

// unmarshalling
var user User
if err := json.NewDecoder(jsonByteSlice).Decode(&user); err != nil {...}

// marshalling
if jsonByteSlice, err := json.Marshal(object); err != nil {...}

// validation
if errs := validator.Validate(user); errs != nil {...}
```

## Pattern 2

Features: [Default Fields]($Default_Fields), [Optional Fields](#optional-fields), [Required Non Default Fields](#required-non-default-fields)

If you just want [Optional Fields](#optional-fields) and [Required Non Default Fields](#required-non-default-fields), and don't mind manually validating and dealing with some maintenance overhead, use this pattern.

```golang
// model
type User struct {
     Name          *string `json:"name"`              // required, but no defaults
     Age           *uint   `json:"age,omitempty"`     // optional
     Address       *string `json:"address,omitempty"` // optional
     FavoriteColor string  `json:"favoriteColor"`     // required, uses defaults
}

// unmarshalling
var user User
if err := json.NewDecoder(jsonByteSlice).Decode(&user); err != nil {...}

// marshalling
if jsonByteSlice, err := json.Marshal(object); err != nil {...}

// validation
func Validate(user User) {
     // default - validate value
     // optional - if non nil, validate value
     // required non default - validate not nil, then validate value
}
```

## Pattern 3

Features: [Default Fields]($Default_Fields), [Optional Fields](#optional-fields), [Required Non Default Fields](#required-non-default-fields), [Easy Validation](#easy-validation)

You can make Pattern 2 support [Easy Validation](#easy-validation) by using multiple validators, plus a custom validator for edge cases. If [Go Validator](https://github.com/go-validator/validator) encounters a pointer, and it is nil, it ignores it, otherwise it dereferences and validates it. This supports [Optional Fields](#optional-fields). If you combine it with the nonzero validator, you can support [Required Non Default Fields](#required-non-default-fields):

```golang
UserId *uint `validate:"nonzero,min=100"`
```

The UserId is a pointer, but it has the nonzero validator, so it can't be nil. It also has the min validator, which only checks the value if it is a non-nil pointer. Combined, they provide [Required Non Default Fields](#required-non-default-fields).

There is a minor catch, in that we can no longer use the nonzero validator on our [Optional Fields](#optional-fields) and [Required Non Default Fields](#required-non-default-fields). This is easily mitigated in most cases by using the min=1 validator instead, but in some cases, like integers, we cannot prevent a zero value. If this is important, you can use a [Custom Validator](https://godoc.org/gopkg.in/validator.v2#hdr-Custom_validation_functions).

```golang
// model
type User struct {
     Name          *string `json:"name"              validate:"nonzero,min=1"` // required, but no defaults
     Age           *uint   `json:"age,omitempty"     validate:"min=1"`         // optional
     Address       *string `json:"address,omitempty" validate:"min=1"`         // optional
     FavoriteColor string  `json:"favoriteColor"`                              // required, uses defaults
}

// unmarshalling
var user User
if err := json.NewDecoder(jsonByteSlice).Decode(&user); err != nil {..}

// marshalling
if jsonByteSlice, err := json.Marshal(object); err != nil {...}

// validation
if errs := validator.Validate(user); errs != nil {...}
```

## Pattern 4

Features: [Default Fields]($Default_Fields), [Required Non Default Fields](#required-non-default-fields), [Easy Validation](#easy-validation), [Custom Default Fields](#custom-default-fields), [Dereferenced Required Fields](#dereferenced-required-fields)

This Pattern provides all of the [Features](#features) we've discussed, and lets us simplify the validation from [Pattern 3](#pattern-3). It's a good general purpose solution that avoids some long term maintenance, but is probably overkill for very simple projects.

The idea is to create an intermediate representation, one for each interface to the model. This separates the model from how it is built. For example, you might have a User model, a PostUserRequest, and a PutUserRequest, each with different validation. The business logic only cares about the Model, so it can be helpful to decouple said Model from how it is constructed or modified.

This separation of validation lets us achieve [Custom Default Fields](#custom-default-fields) and [Dereferenced Required Fields](#dereferenced-required-fields) in a natural way, by performing them during the translation from intermediate representation to Model.

It also removes the catch from Pattern 3 for [Required Non Default Fields](#required-non-default-fields), since we validate the pointer separately from the value.

```golang
// post request
type UserPostRequest struct {
     Name               *string `json:"name" validate:"nonzero"` // required, but no defaults
     Age                *uint   `json:"age"`                     // optional
     Address            *string `json:"address"`                 // optional
     FavoriteInstrument string  `json:"favoriteInstrument"`      // required, uses defaults
     FavoriteColor      *string `json:"favoriteColor"`           // required, uses custom defaults
}

// model
type User struct {
     Name               string  `json:"name" validate:"nonzero"`            // required
     Age                *uint   `json:"age,omitempty" validate:"min=1"`     // optional
     Address            *string `json:"address,omitempty" validate:"min=1"` // optional
     FavoriteInstrument string  `json:"favoriteInstrument"`                 // required
     FavoriteColor      string  `json:"favoriteColor" validate:"nonzero"`   // required
}

// unmarshalling
var postRequest UserPostRequest
if err := json.NewDecoder(jsonByteSlice).Decode(&postRequest); err != nil {..}
if errs := validator.Validate(postRequest); errs != nil {...}

user.Name = *postRequest.Name
user.Age = postRequest.Age
user.Address = postRequest.Address
user.FavoriteInstrument = postRequest.FavoriteInstrument
user.FavoriteColor = "blue"
if postRequest.FavoriteColor != nil {
  user.FavoriteColor = *postRequest.FavoriteColor
}
if errs := validator.Validate(user); errs != nil {...}

// marshalling
if jsonByteSlice, err := marshal(object); err != nil {...}

// validation
if errs := validator.Validate(user); errs != nil {...}
```

Though it looks like unnecessary duplication, this format lets you separate the PostRequest from the actual Model, which can be very useful. Notice how we also did all the validation the Model, except for [Required Non Default Fields](#required-non-default-fields).

# Conclusion

I've covered 4 different [Patterns](#patterns) for json management, each more comprehensive than the last. Hopefully I've also given you a good feeling for what [Features](#features) might be needed in a json api, and how you can approach providing them.

I'm currently battle testing Pattern 4 in a project of mine - [Render Cloud](https://github.com/bcokert/render-cloud).

I hope this overview is useful to you. I learned a lot by coming up with the [Patterns](#patterns) and investigating them, and I hope this will expedite the process for your own projects.
