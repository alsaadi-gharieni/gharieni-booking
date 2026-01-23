'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getAllDevices, createDevice, updateDevice, deleteDevice } from '@/lib/firestore'
import { Device } from '@/types'
import toast from 'react-hot-toast'
import { isAuthenticated } from '@/lib/auth'

export default function DevicesManagement() {
  const router = useRouter()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/admin/login')
      return
    }
    setAuthChecked(true)
    loadDevices()
  }, [router])

  const loadDevices = async () => {
    try {
      const devicesData = await getAllDevices()
      setDevices(devicesData)
    } catch (error) {
      console.error('Error loading devices:', error)
      toast.error('Failed to load devices')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('Device name is required')
      return
    }

    try {
      if (editingDevice) {
        await updateDevice(editingDevice.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        })
        toast.success('Device updated successfully!')
      } else {
        await createDevice({
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        })
        toast.success('Device created successfully!')
      }
      
      setShowForm(false)
      setEditingDevice(null)
      setFormData({ name: '', description: '' })
      await loadDevices()
    } catch (error) {
      console.error('Error saving device:', error)
      toast.error('Failed to save device')
    }
  }

  const handleEdit = (device: Device) => {
    setEditingDevice(device)
    setFormData({
      name: device.name,
      description: device.description || '',
    })
    setShowForm(true)
  }

  const handleDelete = async (deviceId: string, deviceName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${deviceName}"?\n\n` +
      `This action cannot be undone.`
    )
    
    if (!confirmed) {
      return
    }
    
    try {
      await deleteDevice(deviceId)
      toast.success('Device deleted successfully')
      await loadDevices()
    } catch (error) {
      console.error('Error deleting device:', error)
      toast.error('Failed to delete device')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingDevice(null)
    setFormData({ name: '', description: '' })
  }

  if (!authChecked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Device Management</h1>
          <div className="flex gap-4">
            <Link
              href="/admin"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50"
            >
              ← Back to Dashboard
            </Link>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                + Add Device
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingDevice ? 'Edit Device' : 'Add New Device'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-2">
                  Device Name *
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="e.g., Massage Chair 1"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-2">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-900"
                  placeholder="Device description or notes..."
                />
              </div>

              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-900 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {editingDevice ? 'Update Device' : 'Create Device'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              All Devices ({devices.length})
            </h2>
            {devices.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-800 mb-4">No devices yet.</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Create Your First Device
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-indigo-400 hover:shadow-md transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg">{device.name}</h3>
                        {device.description && (
                          <p className="text-sm text-gray-700 mt-1">{device.description}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          Created: {new Date(device.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => handleEdit(device)}
                          className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(device.id, device.name)}
                          className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
