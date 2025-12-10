{{/*
Expand the name of the chart.
*/}}
{{- define "kappi1.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "kappi1.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "kappi1.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "kappi1.labels" -}}
helm.sh/chart: {{ include "kappi1.chart" . }}
{{ include "kappi1.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "kappi1.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kappi1.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Backend labels
*/}}
{{- define "kappi1.backend.labels" -}}
{{ include "kappi1.labels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Backend selector labels
*/}}
{{- define "kappi1.backend.selectorLabels" -}}
{{ include "kappi1.selectorLabels" . }}
app.kubernetes.io/component: backend
{{- end }}

{{/*
Frontend labels
*/}}
{{- define "kappi1.frontend.labels" -}}
{{ include "kappi1.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
Frontend selector labels
*/}}
{{- define "kappi1.frontend.selectorLabels" -}}
{{ include "kappi1.labels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{/*
MongoDB labels
*/}}
{{- define "kappi1.mongodb.labels" -}}
{{ include "kappi1.labels" . }}
app.kubernetes.io/component: mongodb
{{- end }}

{{/*
MongoDB selector labels
*/}}
{{- define "kappi1.mongodb.selectorLabels" -}}
{{ include "kappi1.selectorLabels" . }}
app.kubernetes.io/component: mongodb
{{- end }}

{{/*
Nginx labels
*/}}
{{- define "kappi1.nginx.labels" -}}
{{ include "kappi1.labels" . }}
app.kubernetes.io/component: nginx
{{- end }}

{{/*
Nginx selector labels
*/}}
{{- define "kappi1.nginx.selectorLabels" -}}
{{ include "kappi1.labels" . }}
app.kubernetes.io/component: nginx
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "kappi1.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "kappi1.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Image registry
*/}}
{{- define "kappi1.imageRegistry" -}}
{{- if .Values.global.imageRegistry }}
{{- printf "%s/" .Values.global.imageRegistry }}
{{- end }}
{{- end }}

