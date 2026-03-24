---
name: regulatory-review
description: "Automated regulatory document review system for TFDA submissions. Checks document completeness, compliance, and identifies deficiencies. Use for Fenogal, Gastrilex, and other regulatory projects."
---

# Regulatory Document Review System

Automated checklist and review system for Taiwan FDA (TFDA) regulatory submissions.

## Usage

### Quick Review
```bash
# Review specific project
python ~/.openclaw/workspace/skills/regulatory-review/scripts/review.py --project fenogal

# Review with specific document type
python ~/.openclaw/workspace/skills/regulatory-review/scripts/review.py --project gastrilex --type food-registration
```

### Review Items Check
- Document completeness
- Regulatory compliance
- Format verification
- Required attachments
- Timeline tracking

## Document Types Supported

1. **Drug Registration Extension** (藥品查驗登記展延)
   - License renewal application
   - GMP verification
   - Specification changes
   - Risk assessment reports

2. **Food Registration** (食品查驗登記)
   - Capsule/tablet foods
   - Labeling requirements
   - Nutritional labeling
   - Manufacturing documentation

## Output

Generates standardized review report with:
- Pass/Fail status per item
- Risk assessment
- Action items
- Timeline tracking
