<!--
In the eCTD File Organisation: "util/dtd/tw-envelope.mod"

Version 2.0
October 2025

Meaning or value of the suffixes:
? : element must appear 0 or 1 time
* : element must appear 0 or more time
+ : element must appear 1 or more times
<none>: element must appear once and only once
Changes V2.0:  <!ATTLIST procedure type CDATA #FIXED "national"
			 
-->

<!-- ................................................................... -->
<!ELEMENT tw-envelope (
	envelope
)>

<!ELEMENT envelope (
	identifier,
	submission,
	submission-unit,
	applicant,  
	procedure,
	invented-name+,
	inn+,
	sequence,
	related-sequence+,
	submission-description
)>

<!-- ................................................................... -->
<!ELEMENT identifier            ( #PCDATA )>
<!ELEMENT submission   		( type )>
<!ELEMENT type   		EMPTY>
<!ELEMENT submission-unit 	EMPTY>
<!ELEMENT applicant   		( name, corporate-certification-authority, phone-number+, email-address+ ) >
<!ELEMENT corporate-certification-authority ( #PCDATA )>
<!ELEMENT phone-number ( #PCDATA )>
<!ELEMENT email-address ( #PCDATA )>
<!ELEMENT procedure    		EMPTY>
<!ELEMENT invented-name 	( name, drug-permit-license*, pre-assigned-application-number, code+ ) >
<!ELEMENT name ( #PCDATA )>
<!ELEMENT drug-permit-license ( #PCDATA )>
<!ELEMENT pre-assigned-application-number ( #PCDATA )>
<!ELEMENT code ( #PCDATA )>
<!ELEMENT inn		        ( #PCDATA )>
<!ELEMENT sequence		( #PCDATA )>
<!ELEMENT related-sequence 	( #PCDATA )>
<!ELEMENT submission-description ( #PCDATA )>

<!-- ................................................................... -->
<!ATTLIST type
 tier1 (
   domestic
 | import
 | export-only
 ) #IMPLIED
 tier2 (
   new-drugs-application
 | biological-drugs-application
 | generic-drug-application
 | active-pharmaceutical-ingredient
 ) #IMPLIED
 tier3 (
   prescription
 | over-the-counter
 | controlled-drugs
 | nuclear-medicine
 | biological-drugs
 | biosimilar-drugs
 | regenerative-medicine
 | others
 ) #IMPLIED
 tier4 (
   new-chemical-entity
 | new-indication
 | new-combination
 | new-dosage-form
 | new-administration
 | new-dosage
 | new-strength
 | genetic-engineering
 | vaccine
 | plasma-derivative
 | cell-therapy
 | gene-therapy
 | tissue-engineering
 | allergen
 | safety-monitoring
 | non-safety-monitoring
 | others 
 ) #IMPLIED
 tier5 (
   new-chemical-entity
 | new-indication
 | new-combination
 | new-dosage-form
 | new-administration
 | new-dosage
 | new-strength
 | comply-with-otc-criteria
 | not-comply-with-otc-criteria
 | others
 ) #IMPLIED
>

<!-- ................................................................... -->
<!ATTLIST submission
objective ( new | change | extension | expiration ) #REQUIRED
>

<!-- ................................................................... -->
<!ATTLIST submission-unit
type ( initial | validation-response | response | additional-info | corrigendum | reformat ) #REQUIRED
>

<!-- ................................................................... -->
<!ATTLIST procedure
type CDATA #FIXED "national"
>

<!-- +++ --> 