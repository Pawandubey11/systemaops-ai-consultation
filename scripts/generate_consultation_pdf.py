import io
import json
import sys
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether

data = json.load(sys.stdin)
payload = data['payload']
analysis = data['analysis']
reference = data['reference']
company = payload.get('company', {}).get('name', 'Client')
buffer = io.BytesIO()

navy = colors.HexColor('#071329')
blue = colors.HexColor('#225BFF')
cyan = colors.HexColor('#44D2FF')
muted = colors.HexColor('#596579')
light = colors.HexColor('#F2F5FA')
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverLabel', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12, textColor=cyan, spaceAfter=18))
styles.add(ParagraphStyle(name='CoverTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=30, leading=36, textColor=colors.white, spaceAfter=18))
styles.add(ParagraphStyle(name='CoverBody', parent=styles['BodyText'], fontSize=11, leading=17, textColor=colors.HexColor('#D3DAE7')))
styles.add(ParagraphStyle(name='Section', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=17, leading=21, textColor=navy, spaceBefore=12, spaceAfter=10))
styles.add(ParagraphStyle(name='Body2', parent=styles['BodyText'], fontSize=9.5, leading=14, textColor=muted, spaceAfter=7))
styles.add(ParagraphStyle(name='SmallRight', parent=styles['BodyText'], fontSize=8, textColor=muted, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name='Phase', parent=styles['Heading3'], fontSize=10, textColor=blue, spaceAfter=3))

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor('#DDE3EC'))
    canvas.line(18*mm, 14*mm, 192*mm, 14*mm)
    canvas.setFont('Helvetica', 7.5)
    canvas.setFillColor(muted)
    canvas.drawString(18*mm, 9*mm, f'SystemaOps Technology Consultation | {reference}')
    canvas.drawRightString(192*mm, 9*mm, f'Page {doc.page}')
    canvas.restoreState()

doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=18*mm, bottomMargin=20*mm, title=f'SystemaOps Consultation - {company}', author='SystemaOps')
story = []
cover = Table([[Paragraph('SYSTEMAOPS  /  AI-POWERED CONSULTATION', styles['CoverLabel'])], [Paragraph(company, styles['CoverTitle'])], [Paragraph(analysis['executiveSummary'], styles['CoverBody'])], [Spacer(1, 55*mm)], [Paragraph(reference, styles['CoverLabel'])]], colWidths=[174*mm], rowHeights=[18*mm, None, None, 58*mm, 14*mm])
cover.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),navy),('BOX',(0,0),(-1,-1),0,navy),('LEFTPADDING',(0,0),(-1,-1),16*mm),('RIGHTPADDING',(0,0),(-1,-1),16*mm),('TOPPADDING',(0,0),(-1,-1),8*mm),('BOTTOMPADDING',(0,0),(-1,-1),6*mm)]))
story += [cover, PageBreak()]

def section(title, items, numbered=False):
    story.append(Paragraph(title, styles['Section']))
    for i, item in enumerate(items, 1):
        prefix = f'{i}. ' if numbered else '- '
        story.append(Paragraph(prefix + str(item), styles['Body2']))

story += [Paragraph('Executive Summary', styles['Section']), Paragraph(analysis['executiveSummary'], styles['Body2'])]
section('Proposed Solution', analysis['proposedSolution'])
section('Technology Stack', analysis['technologyStack'])
section('System Architecture', analysis['architecture'], True)
section('AI and Automation Opportunities', analysis['aiOpportunities'])

story.append(Paragraph('Development Roadmap', styles['Section']))
phase_cells = []
for item in analysis['roadmap']:
    phase_cells.append([Paragraph(f"Phase {item['phase']}", styles['Phase']), Paragraph(item['name'], styles['Body2']), Paragraph(item['duration'], styles['Body2'])])
roadmap = Table(phase_cells, colWidths=[24*mm, 112*mm, 28*mm], repeatRows=0)
roadmap.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),light),('GRID',(0,0),(-1,-1),.4,colors.HexColor('#DDE3EC')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
story.append(roadmap)
section('Security Recommendations', analysis['security'])
section('Risks', analysis['risks'])
section('Assumptions', analysis['assumptions'])
section('Recommended Next Steps', analysis['nextSteps'], True)
story += [Spacer(1, 6*mm), Table([[Paragraph(analysis['disclaimer'], styles['Body2'])]], colWidths=[164*mm], style=TableStyle([('BACKGROUND',(0,0),(-1,-1),light),('BOX',(0,0),(-1,-1),.7,blue),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)]))]
doc.build(story, onFirstPage=footer, onLaterPages=footer)
sys.stdout.buffer.write(buffer.getvalue())
