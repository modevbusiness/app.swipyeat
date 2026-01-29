'use client'

import React, { useState } from 'react'
import CONTENT from '@/const/content'
import { useLanguage } from '@/lib/context/LanguageContext'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function Login() {
  const { language } = useLanguage()
  const content = CONTENT[language].login
  const supabase = createClient()
  const router = useRouter()

  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!formData.email || !formData.password) {
      setError(content.errors.required)
      return
    }

    if (!validateEmail(formData.email)) {
      setError(content.errors.invalidEmail)
      return
    }

    setIsLoading(true)

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      })
      if (signInError) {
        setError(signInError.message)
        return
      }
      window.location.href = '/'
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-primary">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-block p-3 rounded-2xl mb-4">
            <Image src="/logo.png" alt="Logo" height={128} width={128} />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {content.title}
          </h1>
          <p className="text-gray-600">
            {content.subtitle}
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-2xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-foreground mb-2"
              >
                {content.email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder={content.emailPlaceholder}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                disabled={isLoading}
              />
            </div>

            {/* Password Input */}
            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-foreground mb-2"
              >
                {content.password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder={content.passwordPlaceholder}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                disabled={isLoading}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary hover:bg-primary-hover text-white font-semibold py-3 rounded-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-95"
            >
              {isLoading ? content.buttonTextLoading : content.buttonText}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
