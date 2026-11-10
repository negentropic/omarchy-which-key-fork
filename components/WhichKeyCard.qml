import QtQuick
import QtQuick.Layouts
import qs.Commons
import qs.Ui

BorderSurface {
  id: card

  required property var viewModel
  required property real availableWidth
  readonly property var visibleRows: viewModel && viewModel.rows
    ? viewModel.rows : []
  readonly property var visibleColumns: viewModel && viewModel.columns
    ? viewModel.columns : []
  readonly property var branches: viewModel && viewModel.branches
    ? viewModel.branches : []
  readonly property int pad: Style.space(10)
  readonly property int rowGap: Style.space(4)
  readonly property int keyWidth: Math.ceil(keyMetrics.advanceWidth)

  width: Math.min(content.implicitWidth + borderLeft + pad * 2 + borderRight,
                  availableWidth)
  height: content.implicitHeight + borderTop + pad * 2 + borderBottom
  color: Color.popups.background
  borderSpec: Border.surfaceSpec("popups", "border", Color.popups.border,
                                 Math.max(1, Style.space(1)))
  radius: Style.cornerRadius

  TextMetrics {
    id: keyMetrics
    // Sized to the widest label in view (never narrower than "Backspace") so
    // labels like "Scroll ↓" or "Right Mouse" are never cut off.
    text: card.viewModel && card.viewModel.widestLabel
      && card.viewModel.widestLabel.length > 9 ? card.viewModel.widestLabel : "Backspace"
    font.family: Style.font.family
    font.pixelSize: Style.font.body
    font.bold: true
  }

  ColumnLayout {
    id: content
    anchors.fill: parent
    anchors.topMargin: card.borderTop + card.pad
    anchors.rightMargin: card.borderRight + card.pad
    anchors.bottomMargin: card.borderBottom + card.pad
    anchors.leftMargin: card.borderLeft + card.pad
    spacing: Style.space(6)

    Text {
      textFormat: Text.PlainText
      text: card.viewModel ? card.viewModel.title : ""
      color: Color.muted
      font.family: Style.font.family
      font.pixelSize: Style.font.caption
      font.bold: true
      font.letterSpacing: 1.5
    }

    Rectangle {
      Layout.fillWidth: true
      Layout.preferredHeight: Math.max(1, Style.space(1))
      color: Color.popups.border
    }

    RowLayout {
      spacing: Style.space(16)

      Repeater {
        model: card.visibleColumns

        delegate: ColumnLayout {
          id: column
          required property var modelData
          Layout.alignment: Qt.AlignTop
          spacing: card.rowGap

          Repeater {
            model: column.modelData

            delegate: ColumnLayout {
              id: entry
              required property var modelData
              required property int index
              spacing: card.rowGap
              // A little air where one section (or kind of key) ends and the next
              // begins.
              Layout.topMargin: (modelData.header || modelData.groupStart) && index > 0
                ? Style.space(8) : 0

              // Section header, shown on the first row of each category in a column.
              Text {
                visible: !!entry.modelData.header
                textFormat: Text.PlainText
                text: entry.modelData.header ? entry.modelData.header.toUpperCase() : ""
                color: Color.muted
                font.family: Style.font.family
                font.pixelSize: Style.font.caption
                font.bold: true
                font.letterSpacing: 1.2
              }

              RowLayout {
                spacing: Style.space(6)

                Text {
                  textFormat: Text.PlainText
                  Layout.preferredWidth: card.keyWidth
                  Layout.alignment: Qt.AlignTop
                  text: modelData.label
                  color: Color.accent
                  font.family: Style.font.family
                  font.pixelSize: Style.font.body
                  font.bold: true
                  elide: Text.ElideRight
                }

                Text {
                  textFormat: Text.PlainText
                  // Natural width up to a cap; longer descriptions wrap onto a second
                  // line instead of being elided.
                  Layout.maximumWidth: Style.space(250)
                  Layout.alignment: Qt.AlignTop
                  text: modelData.description
                  color: Color.popups.text
                  font.family: Style.font.family
                  font.pixelSize: Style.font.body
                  font.weight: Font.Normal
                  wrapMode: Text.Wrap
                }
              }
            }
          }
        }
      }
    }

    // Next steps of the combo: modifiers that can still be added, and how many
    // shortcuts each one opens up.
    Rectangle {
      visible: card.branches.length > 0 && card.visibleRows.length > 0
      Layout.fillWidth: true
      Layout.preferredHeight: Math.max(1, Style.space(1))
      color: Color.popups.border
    }

    Flow {
      visible: card.branches.length > 0
      Layout.fillWidth: true
      Layout.preferredWidth: card.keyWidth + Style.space(196)
      spacing: Style.space(6)

      Repeater {
        model: card.branches

        delegate: Rectangle {
          required property var modelData
          width: chipText.implicitWidth + Style.space(12)
          height: chipText.implicitHeight + Style.space(6)
          radius: Style.cornerRadius
          color: "transparent"
          border.width: Math.max(1, Style.space(1))
          border.color: Color.accent

          Text {
            id: chipText
            anchors.centerIn: parent
            textFormat: Text.PlainText
            text: "+ " + modelData.label + "  " + modelData.count
            color: Color.accent
            font.family: Style.font.family
            font.pixelSize: Style.font.caption
            font.bold: true
          }
        }
      }
    }
  }
}
