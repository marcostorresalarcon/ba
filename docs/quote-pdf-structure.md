# Quote PDF Structure

Reference document for implementing PDF generation for kitchen estimates.

---

## Sections and Fields

### 1. Header / Cover

| Field | Source | Notes |
|---|---|---|
| Estimate Version | `quote.versionNumber` | "Estimate v3" |
| Category | `quote.category` | "Kitchen" |
| Status | `quote.status` | Render as badge |
| Change Order flag | `quote.isChangeOrder` | Conditional badge |
| Date Created | `quote.createdAt` | Formatted |
| Total Cost | `quote.totalPrice` | Large, prominent |

### 2. Customer

| Field | Source | Notes |
|---|---|---|
| Name | `quote.customer.name` (populated) | Required |
| Email | `quote.customer.email` | Conditional |
| Phone | `quote.customer.phone` | Conditional |

### 3. Project Details

| Field | Source | Notes |
|---|---|---|
| Project Name | `quote.projectName` | |
| Experience Level | `quote.experience` | capitalize |
| Kitchen Size / Type | `quote.kitchenInformation.type` | Conditional |
| Square Footage | `quote.kitchenInformation.kitchenSquareFootage` | Conditional, append "SF" |
| Ceiling Height | `quote.kitchenInformation.ceilingHeight` | Conditional, append "ft" |
| Client Budget | `quote.clientBudget` | Conditional |
| Rough Quote | `quote.roughQuote` | Conditional, hidden from customer role |
| Notes | `quote.notes` | Conditional, italic |
| Address | `quote.address` | Conditional |
| Source | `quote.source` | Conditional |

### 4. Kitchen Details (Dynamic)

Sourced from `quote.kitchenInformation` via the same category/subcategory config used in the form.

- Iterate `categories()` (the same groupedInputs signal)
- For each category group: render section header
- For each subcategory (non-default): render subsection header
- For each input: render label + value only if value is truthy, not `false`, not `''`, not `'No'`
- Boolean `true` renders as "Yes"
- Append `input.unit` when present

**Sub-sections that appear here:**
- Kitchen Information (type, square footage, ceiling height, island, pantry, etc.)
- Location Kitchen (floor level, room access, parking, etc.)
- Cabinets
- Countertops
- Backsplash
- Appliances
- Plumbing / Sink
- Flooring / Sub Floor
- Lighting / Electrical
- Painting / Drywall
- Any other dynamic category added to the config

### 5. Materials

Conditional on `quote.materials` being present.

| Sub-section | Source | Notes |
|---|---|---|
| Materials file | `quote.materials.file` | S3 URL - include as image or "See attached PDF" |
| Materials items | `quote.materials.items[]` | Array of `{ description, quantity }` |

Render items as a two-column table: Qty | Description.

### 6. Media

#### 6a. Countertops Files
- Source: `quote.kitchenInformation.countertopsFiles[]`
- Conditional: array length > 0
- Render as image grid (images) or list with icon (videos/files)

#### 6b. Backsplash Files
- Source: `quote.kitchenInformation.backsplashFiles[]`
- Conditional: array length > 0

#### 6c. Sketches
- Source: `quote.kitchenInformation.sketchFiles[]` (preferred) or `quote.kitchenInformation.sketchFile` (legacy single)
- Conditional: either present
- Render full-width or two-per-row

#### 6d. Additional Comments Media
- Source: `quote.kitchenInformation.additionalComments.mediaFiles[]`
- Conditional: array length > 0
- Include comment text: `quote.kitchenInformation.additionalComments.comment`

### 7. Voice Notes

- Source: `quote.kitchenInformation.audioNotes` (single object) or `quote.kitchenInformation.audioNotes[]` (array form uses `form.controls.audioNotes`)
- Conditional: present and non-empty
- Fields per note: `url` (audio file), `summary`, `transcription`
- In PDF: include summary and transcription as text; audio URL as footnote link (cannot play in PDF)

### 8. Status Section (Footer or Final Page)

#### Approved
- Conditional: `quote.status === 'approved'`
- Show: approval date (`quote.updatedAt`)

#### Rejected
- Conditional: `quote.status === 'rejected'` and `quote.rejectionComments` present
- Fields:
  - `quote.rejectionComments.comment`
  - `quote.rejectionComments.rejectedAt`
  - `quote.rejectionComments.mediaFiles[]` (images/videos)

---

## Suggested Page Layout

```
Page 1 - Cover
  - Company logo (top)
  - Estimate title + version + status badge
  - Date | Category
  - Total Cost (large)
  - Customer block (name, email, phone)
  - Project block (address, experience, kitchen size, SF, ceiling height)
  - Budget block (client budget, rough quote - staff only)
  - Notes

Page 2+ - Kitchen Details
  - One section per category group
  - Fields in 2-3 column grid
  - Sub-section dividers

Page N - Materials
  - Materials file image (if image) or "PDF attached"
  - Materials items table

Page N+1 - Media
  - Countertops images (grid, 2-3 per row)
  - Backsplash images (grid)
  - Sketches (1-2 per row, larger)
  - Additional media (grid)

Page N+2 - Voice Notes
  - Per-note: summary paragraph, transcription (smaller/italic), audio link

Last Page - Status (if approved or rejected)
  - Approval strip or rejection detail
```

---

## Conditional Field Summary

| Field | Condition |
|---|---|
| isChangeOrder badge | `quote.isChangeOrder === true` |
| Kitchen size/type | `kitchenInformation.type` truthy |
| Square footage | `kitchenInformation.kitchenSquareFootage` truthy |
| Ceiling height | `kitchenInformation.ceilingHeight` truthy |
| Client budget | `quote.clientBudget` truthy |
| Rough quote | `quote.roughQuote` truthy AND viewer is not customer role |
| Notes | `quote.notes` truthy |
| Materials section | `quote.materials.file` OR `quote.materials.items.length > 0` |
| Countertops files | `kitchenInformation.countertopsFiles.length > 0` |
| Backsplash files | `kitchenInformation.backsplashFiles.length > 0` |
| Sketches | `kitchenInformation.sketchFiles.length > 0` OR `kitchenInformation.sketchFile` |
| Additional media | `kitchenInformation.additionalComments.mediaFiles.length > 0` |
| Audio section | `kitchenInformation.audioNotes` present with url |
| Approval section | `quote.status === 'approved'` |
| Rejection section | `quote.status === 'rejected'` AND `quote.rejectionComments` present |
| Rejection media | `quote.rejectionComments.mediaFiles.length > 0` |

---

## Data Sources by Role

The quote detail page uses `quote()` (signal from API). For PDF generation the same backend quote object is used. Key paths:

- Quote object: `GET /quotes/:id` - returns populated `customer` field
- Rejection comments: nested in `quote.rejectionComments`
- Kitchen data: nested in `quote.kitchenInformation` (mixed flat fields + sub-objects)
- Materials: `quote.materials` (object with `file` URL and `items` array)
- Audio notes: `quote.kitchenInformation.audioNotes` (single object on the API model)

Form controls during creation use `form.controls.*` paths. After submission these map to the API schema fields listed above.
