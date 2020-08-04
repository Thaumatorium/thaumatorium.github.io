# CSS documentation

Since I'm relatively new, I'll document some information. No guarantee I'm actually using it though.

## Glossary

| Abbreviation | Description		 |
|--------------|-----------------|
| RHS					| Right Hand Side |
| LHS					| Left Hand Side	|

## Attributes

You can always prepend `[attr]` with a tag or class name. If none is provided, the `universal selector (*)` is assumed.

`*[hreflang|=en]` and `[hreflang|=en]` are equivalent,
`*.warning` and `.warning` are equivalent,
`*#myid` and `#myid` are equivalent.

### h1[attr]

`attr` exists within `h1`

### div[attr=val]

`attr` exists within a `div` and is exactly `val`

### [attr~=val]

Some `attr` contains a space-separated list of words, one of which is exactly `val`

### [attr|=val]

Some `attr` exists and starts with `val`. `val` may be followed by a `-` and some more text.

Can be used for grouping? At least for languages: `[attr|=en]` would encapsulate `attr=en` and `attr=en-GB`

### [attr^=val]

`attr` starts with `val`. Yes, just like regex.

### [attr$=val]

`attr` ends with `val`. Yes, just like regex.

### [attr*=val]

`attr` contains at least one `val`. Not like regex - regex uses `+` for that.

\- [source](https://www.w3.org/TR/selectors-4/#attribute-representation)

## Combinators

### LHS>RHS

Child combinator
This means the RHS is a **direct** child of LHS

``` HTML
<LHS>
		<RHS />
</LHS>
```

### LHS RHS

Descendant combinator
RHS is some descendant of LHS (could be very shallow *or* very deep into the DOM – it doesn't matter)

``` HTML
<LHS>
		<one-or-more-levels-deep>
				<RHS />
		</one-or-more-levels-deep>
</LHS>
```

### LHS+RHS

Next-subling combinator
RHS follows RHS. In other words: RHS sits *directly below* LHS.

``` HTML
<LHS></LHS>
<RHS></RHS>
```

### LHS~RHS

Subsequent-sibling combinator
RHS follows RHS with more tags between. In other words: RHS sits *somewhere below* LHS.

``` HTML
<RHS></RHS>
<one-or-more-tags />
<LHS></LHS>
```

### LHS : RHS

RHS is a pseudo-**class** of LHS

**Options:**

* is()
* not()
* where()
* has()
* dir()
* lang()
* any-link
* link
* visited
* local-link
* target
* target-within
* scope
* hover
* active
* focus
* focus-visible
* focus-within
* current
* past
* future
* playing
* paused
* enabled
* disabled
* read-only
* read-write
* placeholder-shown
* default
* checked
* indeterminate
* blank
* valid
* invalid
* in-range
* out-of-range
* required
* optional
* user-invalid
* root
* empty
* nth-child()
* nth-last-child()
* first-child
* last-child
* only-child
* nth-of-type()
* nth-last-of-type()
* first-of-type
* last-of-type
* only-of-type
* nth-col()
* nth-last-col()

\- [source](https://www.w3.org/TR/selectors-4/#combinators)

## LHS:: RHS

RHS is a pseudo-**element** of LHS

**Options:**

* first-line
* first-letter
* selection
* inactive-selection
* spelling-error
* grammar-error
* before
* after
* marker
* placeholder

\- [source](https://www.w3.org/TR/css-pseudo-4/)
