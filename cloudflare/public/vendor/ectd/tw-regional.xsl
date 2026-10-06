<?xml version="1.0" encoding="iso-8859-1" standalone="no"?>

<!--
	TW Regional XSL
	Version: 2.0
	Date: 2025-10-08
	Authors: EXTEDO
-->

<xsl:stylesheet version="2.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:tw="http://www.fda.gov.tw"
	xmlns:xlink="http://www.w3c.org/1999/xlink">

	<xsl:output method="html" encoding="UTF-8" indent="no"/>

	<xsl:template match="/">
		<html>
			<head>
				<title>Taiwan Module 1 - DTD version <xsl:value-of select="/tw:tw-backbone/@dtd-version"/></title>
				<style type="text/css">
					h1, h2, h3, h4, h5 {margin-top:3pt ; margin-bottom:0pt}
					ul {margin-bottom:0pt ; margin-top:0pt}
				</style>
			</head>
			<body>
				<center>
					<h1>Taiwan Module 1</h1>
					<small>DTD version <xsl:value-of select="/tw:tw-backbone/@dtd-version"/></small>
				</center>
				<xsl:apply-templates select="//envelope"/>
				<br/>
				<xsl:apply-templates select="//m1-tw"/>
			</body>
		</html>
	</xsl:template>

	<xsl:template match="*|@*" mode="data">
		<xsl:value-of select="."/>
	</xsl:template>

	<xsl:template match="*|@*" mode="data-small">
		<small><xsl:value-of select="."/></small>
	</xsl:template>

	<xsl:template match="*|@*" mode="csv">
		<xsl:value-of select="."/>
		<xsl:if test="position() != last()"><xsl:text>, </xsl:text></xsl:if>
	</xsl:template>

	<xsl:template match="*|@*" mode="csv-small">
		<small><xsl:value-of select="."/></small>
		<xsl:if test="position() != last()"><small><xsl:text>, </xsl:text></small></xsl:if>
	</xsl:template>

	<xsl:template match="*|@*" mode="objective">
		<xsl:choose>
			<xsl:when test="@objective='new'">New</xsl:when>
			<xsl:when test="@objective='change'">Change</xsl:when>
			<xsl:when test="@objective='extension'">Extension</xsl:when>
			<xsl:when test="@objective='expiration'">Expiration</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="*|@*" mode="type">
		<xsl:choose>
			<xsl:when test="@tier1='domestic'">Domestic</xsl:when>
			<xsl:when test="@tier1='import'">Import</xsl:when>
			<xsl:when test="@tier1='export-only'">Export Only</xsl:when>
		</xsl:choose>
		<xsl:text> - </xsl:text>
		<xsl:choose>
			<xsl:when test="@tier2='new-drugs-application'">New Drugs Application</xsl:when>
			<xsl:when test="@tier2='biological-drugs-application'">Biological Drugs Application</xsl:when>
			<xsl:when test="@tier2='generic-drug-application'">Generic Drug Application</xsl:when>
			<xsl:when test="@tier2='active-pharmaceutical-ingredient'">Active Pharmaceutical Ingredient</xsl:when>
		</xsl:choose>
		<xsl:text> - </xsl:text>
		<xsl:choose>
			<xsl:when test="@tier3='prescription'">Prescription</xsl:when>
			<xsl:when test="@tier3='over-the-counter'">Over The Counter</xsl:when>
			<xsl:when test="@tier3='controlled-drugs'">Controlled Drugs</xsl:when>
			<xsl:when test="@tier3='nuclear-medicine'">Nuclear Medicine</xsl:when>
			<xsl:when test="@tier3='biological-drugs'">Biological Drugs</xsl:when>
			<xsl:when test="@tier3='biosimilar-drugs'">Biosimilar Drugs</xsl:when>
			<xsl:when test="@tier3='regenerative-medicine'">Regenerative Medicine</xsl:when>
			<xsl:when test="@tier3='others'">Others</xsl:when>
		</xsl:choose>
		<xsl:if test="@tier4!=''"><xsl:text> - </xsl:text></xsl:if>
		<xsl:choose>
			<xsl:when test="@tier4='new-chemical-entity'">New Chemical Entity</xsl:when>
			<xsl:when test="@tier4='new-indication'">New Indication</xsl:when>
			<xsl:when test="@tier4='new-combination'">New Combination</xsl:when>
			<xsl:when test="@tier4='new-dosage-form'">New Dosage Form</xsl:when>
			<xsl:when test="@tier4='new-administration'">New Administration</xsl:when>
			<xsl:when test="@tier4='new-dosage'">New Dosage</xsl:when>
			<xsl:when test="@tier4='new-strength'">New Strength</xsl:when>
			<xsl:when test="@tier4='genetic-engineering'">Genetic Engineering</xsl:when>
			<xsl:when test="@tier4='vaccine'">Vaccine</xsl:when>
			<xsl:when test="@tier4='plasma-derivative'">Plasma Derivative</xsl:when>
			<xsl:when test="@tier4='cell-therapy'">Cell Therapy</xsl:when>
			<xsl:when test="@tier4='gene-therapy'">Gene Therapy</xsl:when>
			<xsl:when test="@tier4='tissue-engineering'">Tissue Engineering</xsl:when>
			<xsl:when test="@tier4='allergen'">Allergen</xsl:when>
			<xsl:when test="@tier4='safety-monitoring'">Safety Monitoring</xsl:when>
			<xsl:when test="@tier4='non-safety-monitoring'">Non-Safety Monitoring</xsl:when>
			<xsl:when test="@tier4='others'">Others</xsl:when>
		</xsl:choose>
		<xsl:if test="@tier5!=''"><xsl:text> - </xsl:text></xsl:if>
		<xsl:choose>
			<xsl:when test="@tier5='new-chemical-entity'">New Chemical Entity</xsl:when>
			<xsl:when test="@tier5='new-indication'">New Indication</xsl:when>
			<xsl:when test="@tier5='new-combination'">New Combination</xsl:when>
			<xsl:when test="@tier5='new-dosage-form'">New Dosage Form</xsl:when>
			<xsl:when test="@tier5='new-administration'">New Administration</xsl:when>
			<xsl:when test="@tier5='new-dosage'">New Dosage</xsl:when>
			<xsl:when test="@tier5='new-strength'">New Strength</xsl:when>
			<xsl:when test="@tier5='comply-with-otc-criteria'">Comply With OTC Criteria</xsl:when>
			<xsl:when test="@tier5='not-comply-with-otc-criteria'">Not Comply With OTC Criteria</xsl:when>
			<xsl:when test="@tier5='others'">Others</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="*|@*" mode="submission-unit">
		<xsl:choose>
			<xsl:when test="@type='initial'">Initial</xsl:when>
			<xsl:when test="@type='validation-response'">Validation Response</xsl:when>
			<xsl:when test="@type='response'">Response</xsl:when>
			<xsl:when test="@type='additional-info'">Additional Info</xsl:when>
			<xsl:when test="@type='corrigendum'">Corrigendum</xsl:when>
			<xsl:when test="@type='reformat'">Reformat</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="*|@*" mode="procedure">
		<xsl:choose>
			<xsl:when test="@type='national'">National</xsl:when>
		</xsl:choose>
	</xsl:template>

	<xsl:template match="*|@*" mode="invented-name-row">
		<tr>
			<td><xsl:apply-templates select="./name" mode="data-small"/></td>
			<td><xsl:apply-templates select="./drug-permit-license" mode="csv-small"/></td>
			<td><xsl:apply-templates select="./pre-assigned-application-number" mode="data-small"/></td>
			<td><xsl:apply-templates select="./code" mode="csv-small"/></td>
		</tr>
	</xsl:template>

	<xsl:template name="invented-name-table">
		<center>
			<table width="96%" border="1px" frame="border" rules="groups" cellpadding="2" cellspacing="0">
				<tr>
					<th width="25%" style="text-align:left"><small>Name</small></th>
					<th width="25%" style="text-align:left"><small>Drug Permit License</small></th>
					<th width="25%" style="text-align:left"><small>Pre-Assigned Application Number</small></th>
					<th style="text-align:left"><small>Code</small></th>
				</tr>
				<xsl:apply-templates select="invented-name" mode="invented-name-row"/>
			</table>
		</center>
	</xsl:template>

	<xsl:template match="*|@*" mode="applicant-row">
		<tr>
			<td><xsl:apply-templates select="./name" mode="data-small"/></td>
			<td><xsl:apply-templates select="./corporate-certification-authority" mode="data-small"/></td>
			<td><xsl:apply-templates select="./phone-number" mode="csv-small"/></td>
			<td><xsl:apply-templates select="./email-address" mode="csv-small"/></td>
		</tr>
	</xsl:template>

	<xsl:template name="applicant-table">
		<center>
			<table width="96%" border="1px" frame="border" rules="groups" cellpadding="2" cellspacing="0">
				<tr>
					<th width="25%" style="text-align:left"><small>Name</small></th>
					<th width="25%" style="text-align:left"><small>Corporate Certification Authority</small></th>
					<th width="25%" style="text-align:left"><small>Phone Number</small></th>
					<th style="text-align:left"><small>Email Address</small></th>
				</tr>
				<xsl:apply-templates select="applicant" mode="applicant-row"/>
			</table>
		</center>
	</xsl:template>

	<xsl:template match="envelope">
		<center>
			<table width="90%" border="1px" frame="border" rules="groups" cellpadding="2" cellspacing="0">
				<tr>
					<td colspan="2"><h3>Taiwan Envelope</h3></td>
				</tr>
				<tr>
					<td width="25%">Identifier: </td>
					<td><xsl:apply-templates select="identifier" mode="data"/></td>
				</tr>
				<tr>
					<td>Submission Type: </td>
					<td><xsl:apply-templates select="submission/type" mode="type"/></td>
				</tr>
				<tr>
					<td>Submission Objective: </td>
					<td><xsl:apply-templates select="submission" mode="objective"/></td>
				</tr>
				<tr>
					<td>Submission Unit: </td>
					<td><xsl:apply-templates select="submission-unit" mode="submission-unit"/></td>
				</tr>
				<tr>
					<td valign="top">Applicant: </td>
					<td><xsl:call-template name="applicant-table"/></td>
				</tr>
				<tr>
					<td>Procedure: </td>
					<td><xsl:apply-templates select="procedure" mode="procedure"/></td>
				</tr>
				<tr>
					<td valign="top">Invented Name: </td>
					<td><xsl:call-template name="invented-name-table"/></td>
				</tr>
				<tr>
					<td>INN: </td>
					<td><xsl:apply-templates select="inn" mode="csv"/></td>
				</tr>
				<tr>
					<td>Sequence: </td>
					<td><xsl:apply-templates select="sequence" mode="data"/></td>
				</tr>
				<tr>
					<td>Related Sequence: </td>
					<td><xsl:apply-templates select="related-sequence" mode="csv"/></td>
				</tr>
				<tr>
					<td width="25%">Submission Description: </td>
					<td><xsl:apply-templates select="submission-description" mode="data"/></td>
				</tr>
			</table>
		</center>
	</xsl:template>

	<xsl:template match="leaf">
		<li>
			<a>
				<xsl:attribute name="href"><xsl:value-of select="@xlink:href"/></xsl:attribute>
				<xsl:value-of select="title"/>
			</a>
			<xsl:text> </xsl:text>
			(<font color="red"><xsl:value-of select="@operation"/></font>)
			<xsl:if test="position() != last()"><br/></xsl:if>
		</li>
	</xsl:template>

	<xsl:template match="node-extension">
		<li><xsl:apply-templates select="title" mode="data"/>
			<ul type="square">
				<xsl:apply-templates select="leaf | node-extension"/>
			</ul>
		</li>
	</xsl:template>

	<xsl:template match="m1-tw">
		<center>
			<table width="90%" cellpadding="5" cellspacing="2">
				<tr>
					<td colspan="2"><h2>Module 1</h2></td>
				</tr>
				<tr>
					<td width="5%" valign="top">
						<h3>1.1</h3></td>
					<td width="95%">
						<h3>Official Letter and Document</h3>
						<xsl:apply-templates select="m1-1-offdoc/leaf"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.1.1</h4>
					</td>
					<td>
						<h4>Application Form / Official Letter / Response Letter</h4>
						<xsl:apply-templates select="m1-1-offdoc/m1-1-1-form"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.1.2</h4>
					</td>
					<td>
						<h4>Type of Application Form</h4>
						<xsl:apply-templates select="m1-1-offdoc/m1-1-2-applform"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.1.3</h4>
					</td>
					<td>
						<h4>Regulatory Information Form</h4>
						<xsl:apply-templates select="m1-1-offdoc/m1-1-3-reginf"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.1.4</h4>
					</td>
					<td>
						<h4>Refuse to File Checklist</h4>
						<xsl:apply-templates select="m1-1-offdoc/m1-1-4-rtfcheck"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.1.5</h4>
					</td>
					<td>
						<h4>Data Exclusivity and Domestic/Foreign Clinical Study Information Form</h4>
						<xsl:apply-templates select="m1-1-offdoc/m1-1-5-dataexc"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.1.6</h4>
					</td>
					<td>
						<h4>Patent Information</h4>
						<xsl:apply-templates select="m1-1-offdoc/m1-1-6-patinf"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.1.7</h4>
					</td>
					<td>
						<h4>Declaration Form of the Status of Pharmaceutical Patents</h4>
						<xsl:apply-templates select="m1-1-offdoc/m1-1-7-decfor"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.1.8</h4>
					</td>
					<td>
						<h4>Receipt</h4>
						<xsl:apply-templates select="m1-1-offdoc/m1-1-8-receip"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.2</h3></td>
					<td>
						<h3>Affidavit</h3>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.2.1</h4>
					</td>
					<td>
						<h4>Affidavit A</h4>
						<xsl:apply-templates select="m1-2-affi/m1-2-1-affia"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.2.2</h4>
					</td>
					<td>
						<h4>Affidavit B</h4>
						<xsl:apply-templates select="m1-2-affi/m1-2-2-affib"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.2.3</h4>
					</td>
					<td>
						<h4>Affidavit C</h4>
						<xsl:apply-templates select="m1-2-affi/m1-2-3-affic"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.3</h3></td>
					<td>
						<h3>Labeling and Artwork</h3>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.3.1</h4>
					</td>
					<td>
						<h4>Labeling</h4>
						<xsl:apply-templates select="m1-3-labart/m1-3-1-lab/leaf"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h5>1.3.1.1</h5>
					</td>
					<td>
						<h5>Chinese Labeling</h5>
						<xsl:apply-templates select="m1-3-labart/m1-3-1-lab/m1-3-1-1-chilab"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h5>1.3.1.2</h5>
					</td>
					<td>
						<h5>English Labeling</h5>
						<xsl:apply-templates select="m1-3-labart/m1-3-1-lab/m1-3-1-2-englab"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h5>1.3.1.3</h5>
					</td>
					<td>
						<h5>Original Labeling</h5>
						<xsl:apply-templates select="m1-3-labart/m1-3-1-lab/m1-3-1-3-orilab"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.3.2</h4>
					</td>
					<td>
						<h4>Medical/Patient Information, Medication Guides</h4>
						<xsl:apply-templates select="m1-3-labart/m1-3-2-mpimg"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.3.3</h4>
					</td>
					<td>
						<h4>Labeling Change Comparison</h4>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h5>1.3.3.1</h5>
					</td>
					<td>
						<h5>Change Comparison</h5>
						<xsl:apply-templates select="m1-3-labart/m1-3-3-labcc/m1-3-3-1-chco"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h5>1.3.3.2</h5>
					</td>
					<td>
						<h5>Labeling History</h5>
						<xsl:apply-templates select="m1-3-labart/m1-3-3-labcc/m1-3-3-2-labhis"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.3.4</h4>
					</td>
					<td>
						<h4>Artwork (Mock-up)</h4>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h5>1.3.4.1</h5>
					</td>
					<td>
						<h5>Container Labels</h5>
						<xsl:apply-templates select="m1-3-labart/m1-3-4-art/m1-3-4-1-conlab"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h5>1.3.4.2</h5>
					</td>
					<td>
						<h5>Outer Package</h5>
						<xsl:apply-templates select="m1-3-labart/m1-3-4-art/m1-3-4-2-outpac"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h5>1.3.4.3</h5>
					</td>
					<td>
						<h5>Aluminium Foil Package</h5>
						<xsl:apply-templates select="m1-3-labart/m1-3-4-art/m1-3-4-3-afp"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h5>1.3.4.4</h5>
					</td>
					<td>
						<h5>Auxiliary/Medical Devices</h5>
						<xsl:apply-templates select="m1-3-labart/m1-3-4-art/m1-3-4-4-amd"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.3.5</h4>
					</td>
					<td>
						<h4>Reference Labeling</h4>
						<xsl:apply-templates select="m1-3-labart/m1-3-5-reflab"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.3.6</h4>
					</td>
					<td>
						<h4>Product Appearance</h4>
						<xsl:apply-templates select="m1-3-labart/m1-3-6-proapp"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.4</h3></td>
					<td>
						<h3>Certificate/License</h3>
						<xsl:apply-templates select="m1-4-lic/leaf"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.4.1</h4>
					</td>
					<td>
						<h4>Pharmaceutical Company Certificate</h4>
						<xsl:apply-templates select="m1-4-lic/m1-4-1-pharmalic"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.4.2</h4>
					</td>
					<td>
						<h4>Business Registration or Certificate</h4>
						<xsl:apply-templates select="m1-4-lic/m1-4-2-busilic"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.4.3</h4>
					</td>
					<td>
						<h4>Product License</h4>
						<xsl:apply-templates select="m1-4-lic/m1-4-3-prodlic"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.4.4</h4>
					</td>
					<td>
						<h4>Local Manufacturing Certificate</h4>
						<xsl:apply-templates select="m1-4-lic/m1-4-4-locmanuflic"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.4.5</h4>
					</td>
					<td>
						<h4>GDP Approval Letter</h4>
						<xsl:apply-templates select="m1-4-lic/m1-4-5-gdpappro"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.5</h3></td>
					<td>
						<h3>Letter of Authorization</h3>
						<xsl:apply-templates select="m1-5-letauthor"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.6</h3></td>
					<td>
						<h3>Reference Country Approval</h3>
						<xsl:apply-templates select="m1-6-refcountryappro/leaf"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.6.1</h4>
					</td>
					<td>
						<h4>Certificate of Pharmaceutical Product</h4>
						<xsl:apply-templates select="m1-6-refcountryappro/m1-6-1-pharmaprodcerti"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.6.2</h4>
					</td>
					<td>
						<h4>Free Sale Certificate / Official Fomulary</h4>
						<xsl:apply-templates select="m1-6-refcountryappro/m1-6-2-salecerti"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.7</h3></td>
					<td>
						<h3>Formulation Basis</h3>
						<xsl:apply-templates select="m1-7-formulbase"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.8</h3></td>
					<td>
						<h3>GMP Certificate / Approval Letter</h3>
						<xsl:apply-templates select="m1-8-gmpcerti"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.9</h3></td>
					<td>
						<h3>Bridging Study Evaluation</h3>
						<xsl:apply-templates select="m1-9-bridgevalu"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.10</h3></td>
					<td>
						<h3>Local Clinical Study Status</h3>
						<xsl:apply-templates select="m1-10-locclinicalstudy"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.11</h3></td>
					<td>
						<h3>Local Bioavailability / Bioequivalence Study Status</h3>
						<xsl:apply-templates select="m1-11-locbabestudy"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.12</h3></td>
					<td>
						<h3>Contract Manufacturing</h3>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.12.1</h4>
					</td>
					<td>
						<h4>Application Form for Contract Manufacture</h4>
						<xsl:apply-templates select="m1-12-contractmanuf/m1-12-1-contractmanufform"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.12.2</h4>
					</td>
					<td>
						<h4>Copy of Contract Manufacturing Agreement</h4>
						<xsl:apply-templates select="m1-12-contractmanuf/m1-12-2-contractmanufagreementcopy"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h4>1.12.3</h4>
					</td>
					<td>
						<h4>Description of Contract Manufacturing Process</h4>
						<xsl:apply-templates select="m1-12-contractmanuf/m1-12-3-contractmanufprodecrip"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.13</h3></td>
					<td>
						<h3>Risk Management Plan</h3>
						<xsl:apply-templates select="m1-13-riskmanagplan"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.14</h3></td>
					<td>
						<h3>DMF Approval Letter</h3>
						<xsl:apply-templates select="m1-14-dmfletter"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.15</h3></td>
					<td>
						<h3>Designation Approval Letter</h3>
						<xsl:apply-templates select="m1-15-desigapproletter"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.16</h3></td>
					<td>
						<h3>Assessment Report from Reference Agency</h3>
						<xsl:apply-templates select="m1-16-refagenassessreport"/>
					</td>
				</tr>
				<tr>
					<td valign="top">
						<h3>1.17</h3></td>
					<td>
						<h3>Others</h3>
						<xsl:apply-templates select="m1-17-others"/>
					</td>
				</tr>
			</table>
		</center>
	</xsl:template>

</xsl:stylesheet>
