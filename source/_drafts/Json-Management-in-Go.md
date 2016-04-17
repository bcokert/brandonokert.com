title: Json Management in Go
tags:
  - go
  - golang
  - json
  - rest
  - validation
  - patterns
author: Brandon Okert
date: 2016-04-16 18:54:11
thumbnailImage:
summary: Strategies for Json Management in Go
---

Managing Json in Go is not a trivial problem. There are many examples out there of how to decode a simple json document into a struct, but few that answer the questions that inevitably come up:
- How do I provide defaults for fields?
- How do I make a field optional?
- How do I avoid using defaults for certain fields (eg: a user id)?
- How do I prevent pointer maintenance issues down the road?
- How do I validate all this?

Below I've outlined several Patterns that provide ideomatic, easy to use, and easy to test solutions to these problems. Different patterns solve different sets of problems - thus you can pick the solution that is most relevant to your application.

# Primer
(( Image showing all the transitions )) 
A Model is a struct that has meaning in our application - a User, a Scene, a Parcel. Models can be Marshaled into json, and the result is usually put directly into an io.Writer. Inversely, json can be Unmarshaled into new Models, assuming the json is legal. In all but the most trivial applications, we need to Validate incoming json, which in go is usually done after Unmarshaling.

When Unmarshaling json into a Model, we utilize struct tags to denote the field name. When Marshaling, we use the same tags, as well as a new one to signal whether it should be omitted when empty:
```golang
type Model struct {
  UserId uint `json:"user_id"`
  Address string `json:"address,omitempty"` // if empty, don't encode it at all
}
```

Our desired features dictate how we structure our Models, and how we Marshal, Unmarshal, and Validate them.

# Features

Below I've described in detail each feature that we might want, so that it's easy to identify which features each Pattern provides.

## Default Fields
```golang
ProductCount uint // required, but zero is a safe default
```
This is a field that is required, but if the user doesn't provide one we're ok with using the default value provided by go. The default value is valid, so validation is simple.

Defaults in go come for free - if a field is not present in the source json, a default value (0, "", nil, etc.) will be used. This can be very convenient, but it only works in cases where the default is legal and where you are willing to allow the default value (you probably don't want POST /user/ to use a default ID, even if the default is a legal ID).

## Custom Default Fields
```golang
FavoriteColor string // a default is ok, but we don't want the empty string
```
This is a field where you want a default value, but not the zero value. Validation is simple once we've provided the default value.

The process is a little more involved than basic default values, but we'll see how supporting [Required Non Default Fields](#Required_Non_Default_Fields) can give us [Custom Default Fields](#Custom_Default_Fields) for free.

## Optional Fields
```golang
Address *string // we don't require an address, though we still want to validate it if it's there
```
This is a field that may or may not be available. If present, we want to validate it, but if not present, we don't want to fail validation.

[Github](https://willnorris.com/2014/05/go-rest-apis-and-pointers) popularized the method of using pointers for this purpose, as their default value is nil and there is no such thing as a pointer in json. It adds a bit of overhead due to developers needing to handle the case where it's optional, but really there's no way around it if the value is truly optional. Validation is the more tedious part of this, as you have to handle both the case where it's present and the case where it's not. For fields that you don't want defaults for, but still want them to be required, use [Required Non Default Fields](#Required_Non_Default_Fields) instead.

## Required Non Default Fields
```golang
UserId *uint // it's required, but providing a default doesn't make sense
```
This is a field that is required, but we don't want to provide a default for, such as an ID in a get request. Validating it is similar to [Optional Fields](#Optional_Fields), except the case where it is missing is now invalid.

We can re-use the pointer method from [Optional Fields](#Optional_Fields), and just change the validation. However, this leaves us with a pointer that will always have a value, which adds unwanted maintenance. We can avoid this completely with [Dereferenced Required Fields](#Dereference_Required_Fields), which also opens the door for several other improvements.

## Dereferenced Required Fields
```golang
type Request struct {
  UserId *uint // this is a Required Non-Default Field, so it needs a pointer
}

type Model struct {
  UserId uint // but it's not actually optional, so we don't want the pointer in the model
}
```
This is a meta-feature, wherein we've used a pointer for some reason in our struct, but really that pointer should never be nil. By dereferencing it, we save ourselves a bunch of maintenance and testability headaches down the road.

The idea is to separate the model from the json request that creates it, using intermediate representations. As we'll see, this can make other features like [Custom Default Fields](Custom_Default_Fields) trivial to implement, and it can make partial updates (where any subset of fields may be present) easier to manage down the road.

## Easy Validation
```golang
UserId *uint `validate:"nonzero"`
Age Uint `validate:"min=18"`
```
Easy Validation lets us verify that our models are in a legal state after Unmarshaling, without having to manually verify every field and every case.

In its simplest form, validation can be done manually, thus making it easy to port to any solution. The ideomatic [Go Validator](https://github.com/go-validator/validator) is an alternative to manual validation with many desirable qualities. However, making it support other features like [Optional Fields](#Optional_Fields) requires either extending it, or changing how we validate. We can utilize the [Dereferenced Required Fields](#Dereferenced_Required_Fields) solution of intermediate representations to avoid extending the library whilst still benefiting from it. 

# Patterns

Each Pattern provides a subset of the above fields. If you don't need certain features, don't pick a Pattern that provides them, as the extra effort wont pay off. Most of the more complex Patterns focus on doing more work up front so that maintenance down the road is much easier.

## Pattern 1
Features: [Default Fields]($Default_Fields), [Easy Validation](#Easy_Validation)

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
Features: [Default Fields]($Default_Fields), [Optional Fields](#Optional_Fields), [Required Non Default Fields](#Required_Non_Default_Fields)

If you just want [Optional Fields](#Optional_Fields) and [Required Non Default Fields](#Required_Non_Default_Fields), and don't mind manually validation and dealing with some maintenance overhead, use this pattern.

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
Features: [Default Fields]($Default_Fields), [Optional Fields](#Optional_Fields), [Required Non Default Fields](#Required_Non_Default_Fields), [Easy Validation](#Easy_Validation)

You can make Pattern 2 support [Easy Validation](#Easy_Validation) by using multiple validators, plus a custom validator for edge cases. If Go Validator encounters a pointer, and it is nil, it ignores it, otherwise it dereferences and validates it. This supports [Optional Fields](#Optional_Fields). If you combine it with the nonzero validator, you can support [Required Non Default Fields](#Required_Non_Default_Fields):
```golang
UserId *uint `validate:"nonzero,min=100"` 
```
The UserId is a pointer, but it has the nonzero validator, so it can't be nil. It also has the min validator, which only checks the value if it is a non-nil pointer. Combined, they provide [Required Non Default Fields](#Required_Non_Default_Fields).

There is a minor catch, in that we can no longer use the nonzero validator on our [Optional Fields](#Optional_Fields) and [Required Non Default Fields](#Required_Non_Default_Fields). This is easily mitigated in most cases by using the min=1 validator instead, but in some cases, like integers, we cannot prevent a zero value. If this is important, you can use a [the Go Validator docs](https://godoc.org/gopkg.in/validator.v2#hdr-Custom_validation_functions).

```golang
// model
type User struct {
     Name          *string `json:"name"              validate:"nonzero,min=1"` // required, but no defaults
     Age           *uint   `json:"age,omitempty"     validate:"o_nonzero"`     // optional
     Address       *string `json:"address,omitempty" validate:"o_nonzero"`     // optional
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
Features: [Default Fields]($Default_Fields), [Required Non Default Fields](#Required_Non_Default_Fields), [Easy Validation](#Easy_Validation), [Custom Default Fields](#Custom_Default_Fields), [Dereferenced Required Fields](#Dereferenced_Required_Fields)

This Pattern provides all of the features we've discussed, and lets us simplify the validation from [Pattern 3](#Pattern_3). It's a good general purpose solution that avoids some long term maintenance, but is probably overkill for very simple projects.

The idea is to create an intermediate representation, one for each interface to the model. This separates the model from how it is built. For example, you might have a User model, a PostUserRequest, and a PutUserRequest, each with different validation. The business logic only cares about the Model, so it can be helpful to decouple said Model from how it is constructed or modified.

This separation of validation lets us achieve [Custom Default Fields](#Custom_Default_Fields) and [Dereferenced Required Fields](#Dereferenced_Required_Fields) in a natural way, and can simplify how we validate [Required Non Default Fields](#Required_Non_Default_Fields).

It also removes the catch from Pattern 3 from [Required Non Default Fields](#Required_Non_Default_Fields), since we validate the pointer separately from the value.

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
user := User{
     intermediate.Name,
     intermediate.Age,
     intermediate.Address,
}
if errs := validator.Validate(user); errs != nil {...} // previous validation only checked for nils

// marshalling
if jsonByteSlice, err := marshal(object); err != nil {...}

// validation
if errs := validator.Validate(user); errs != nil {...}
```

Though it looks like unnecessary duplication, this format lets you separate the PostRequest from the actual Model, which can be very useful. It also separates your layers, meaning testing becomes simpler.

# Conclusion

I've covered 4 different patterns for json management, each more comprehensive than the last. Hopefully I've also given you a good feeling for what features might be needed in a json api, and how you can approach providing them.

I'm currently battle testing Pattern 4 in a project of mine - [Render Cloud](https://github.com/bcokert/render-cloud).

I hope this overview is useful to you. I learned a lot by coming up with the Patterns and investigating them, and I hope this will expedite the process for your own projects.
